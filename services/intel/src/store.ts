// The findings store. Two implementations behind one port: a Postgres-backed store (the
// dedicated intel schema over INTEL_DATABASE_URL) and an in-memory store the tests drive.
// The dedup contract lives in the SQL upsert (and its in-memory twin): a finding is inserted
// once per dedup_key; a re-observation reinforces the row (bumps last_seen + seen_count).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { parseFinding } from "./finding.ts";
import type { Finding, FindingSource } from "./finding.ts";

export interface UpsertResult {
  /** true when this dedup_key was seen for the first time (seen_count === 1). */
  isNew: boolean;
}

export interface Store {
  upsertFinding(finding: Finding, runId: string): Promise<UpsertResult>;
  getWatchState(keys: string[]): Promise<Record<string, string>>;
  setWatchState(entries: Record<string, string>): Promise<void>;
  /** dedup_keys of findings for `source` still active within the window (last_seen ≥ since). */
  openIncidentKeys(
    source: FindingSource,
    sinceEpochMs: number,
  ): Promise<string[]>;
  /** count of NEW findings for `source` within the window (first_seen ≥ since) — the send count. */
  countNewFindings(
    source: FindingSource,
    sinceEpochMs: number,
  ): Promise<number>;
  startRun(watcher: string): Promise<string>;
  finishRun(
    runId: string,
    status: "ok" | "error",
    findingsCount: number,
    error?: string,
  ): Promise<void>;
  close(): Promise<void>;
}

// ── in-memory store (tests) ────────────────────────────────────────────────────────────────
interface MemRow {
  finding: Finding;
  seenCount: number;
  firstSeen: number;
  lastSeen: number;
}

export class InMemoryStore implements Store {
  private readonly findings = new Map<string, MemRow>();
  private readonly watch = new Map<string, string>();
  /** Injectable clock so dedup/window logic is deterministic in tests. */
  constructor(private now: () => number = () => Date.now()) {}

  upsertFinding(finding: Finding, _runId: string): Promise<UpsertResult> {
    const existing = this.findings.get(finding.dedupKey);
    const t = this.now();
    if (existing === undefined) {
      this.findings.set(finding.dedupKey, {
        finding: parseFinding(finding),
        seenCount: 1,
        firstSeen: t,
        lastSeen: t,
      });
      return Promise.resolve({ isNew: true });
    }
    existing.finding = parseFinding(finding);
    existing.seenCount += 1;
    existing.lastSeen = t;
    return Promise.resolve({ isNew: false });
  }

  getWatchState(keys: string[]): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const k of keys) {
      const v = this.watch.get(k);
      if (v !== undefined) out[k] = v;
    }
    return Promise.resolve(out);
  }

  setWatchState(entries: Record<string, string>): Promise<void> {
    for (const [k, v] of Object.entries(entries)) this.watch.set(k, v);
    return Promise.resolve();
  }

  openIncidentKeys(
    source: FindingSource,
    sinceEpochMs: number,
  ): Promise<string[]> {
    const keys = [...this.findings.values()]
      .filter((r) => r.finding.source === source && r.lastSeen >= sinceEpochMs)
      .map((r) => r.finding.dedupKey);
    return Promise.resolve(keys);
  }

  countNewFindings(
    source: FindingSource,
    sinceEpochMs: number,
  ): Promise<number> {
    const n = [...this.findings.values()].filter(
      (r) => r.finding.source === source && r.firstSeen >= sinceEpochMs,
    ).length;
    return Promise.resolve(n);
  }

  startRun(_watcher: string): Promise<string> {
    return Promise.resolve(crypto.randomUUID());
  }
  finishRun(): Promise<void> {
    return Promise.resolve();
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
}

// ── Postgres store (production) ──────────────────────────────────────────────────────────────
export class PostgresStore implements Store {
  private readonly pool: Pool;
  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async upsertFinding(finding: Finding, runId: string): Promise<UpsertResult> {
    const f = parseFinding(finding);
    const res = await this.pool.query<{ seen_count: number }>(
      `INSERT INTO intel.findings
         (id, source, kind, severity, title, body, dedup_key, run_id, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
       ON CONFLICT (dedup_key) DO UPDATE SET
         last_seen  = now(),
         seen_count = intel.findings.seen_count + 1,
         run_id     = excluded.run_id,
         kind       = excluded.kind,
         severity   = excluded.severity,
         title      = excluded.title,
         body       = excluded.body,
         payload    = excluded.payload
       RETURNING seen_count`,
      [
        crypto.randomUUID(),
        f.source,
        f.kind,
        f.severity,
        f.title,
        f.body,
        f.dedupKey,
        runId,
        JSON.stringify(f.payload),
      ],
    );
    return { isNew: (res.rows[0]?.seen_count ?? 1) === 1 };
  }

  async getWatchState(keys: string[]): Promise<Record<string, string>> {
    if (keys.length === 0) return {};
    const res = await this.pool.query<{ key: string; value: string }>(
      `SELECT key, value FROM intel.watch_state WHERE key = ANY($1::text[])`,
      [keys],
    );
    const out: Record<string, string> = {};
    for (const row of res.rows) out[row.key] = row.value;
    return out;
  }

  async setWatchState(entries: Record<string, string>): Promise<void> {
    const keys = Object.keys(entries);
    if (keys.length === 0) return;
    await this.pool.query(
      `INSERT INTO intel.watch_state (key, value)
       SELECT * FROM unnest($1::text[], $2::text[])
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now()`,
      [keys, keys.map((k) => entries[k] ?? "")],
    );
  }

  async openIncidentKeys(
    source: FindingSource,
    sinceEpochMs: number,
  ): Promise<string[]> {
    const res = await this.pool.query<{ dedup_key: string }>(
      `SELECT dedup_key FROM intel.findings
       WHERE source = $1 AND last_seen >= to_timestamp($2 / 1000.0)`,
      [source, sinceEpochMs],
    );
    return res.rows.map((r) => r.dedup_key);
  }

  async countNewFindings(
    source: FindingSource,
    sinceEpochMs: number,
  ): Promise<number> {
    const res = await this.pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM intel.findings
       WHERE source = $1 AND first_seen >= to_timestamp($2 / 1000.0)`,
      [source, sinceEpochMs],
    );
    return Number(res.rows[0]?.n ?? "0");
  }

  async startRun(watcher: string): Promise<string> {
    const id = crypto.randomUUID();
    await this.pool.query(
      `INSERT INTO intel.runs (id, watcher) VALUES ($1, $2)`,
      [id, watcher],
    );
    return id;
  }

  async finishRun(
    runId: string,
    status: "ok" | "error",
    findingsCount: number,
    error?: string,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE intel.runs
       SET finished_at = now(), status = $2, findings_count = $3, error = $4
       WHERE id = $1`,
      [runId, status, findingsCount, error ?? null],
    );
  }

  /** Apply the additive intel-schema migration (idempotent — every statement is IF NOT EXISTS). */
  async migrate(): Promise<void> {
    const sql = readFileSync(
      join(import.meta.dir, "../migrations/0001_intel_schema.sql"),
      "utf8",
    );
    await this.pool.query(sql);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

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
  /** Delete run-ledger rows older than the retention window — the housekeeping step that keeps
   *  intel.runs (one row per watcher invocation, unbounded otherwise) from growing forever. */
  pruneRuns(): Promise<void>;
  /** Proves the connecting DSN role is actually isolated from commerce/public-schema tables —
   *  resolves `true` when a read against `public.accounts` is REJECTED (isolation holds) and
   *  `false` when it SUCCEEDS (the alarm case: the role can read commerce data). An opt-in
   *  self-check, not a hard boot dependency — see server.ts. */
  checkRoleIsolation(): Promise<boolean>;
  close(): Promise<void>;
}

/** Run-ledger retention window (intel.runs P3 housekeeping — unbounded growth otherwise). */
const RUN_RETENTION_DAYS = 90;

/** The minimal shape both `pg.Pool` and `PGlite` structurally satisfy — the seam that lets
 *  `PostgresStore` run against a real Postgres connection string in production and against an
 *  embedded PGlite instance in tests (the store-parity gate: a test passing against InMemoryStore
 *  must also pass against the real SQL this class issues). */
export interface PgQueryable {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
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
  pruneRuns(): Promise<void> {
    return Promise.resolve();
  }
  checkRoleIsolation(): Promise<boolean> {
    return Promise.resolve(true);
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
}

// ── Postgres store (production) ──────────────────────────────────────────────────────────────
export class PostgresStore implements Store {
  private readonly client: PgQueryable;
  /** `pg.Pool` needs an explicit `.end()`; an injected test client (PGlite) is closed by its own
   *  caller (`TestPg.close()`), so this is a no-op in that path. */
  private readonly onClose: () => Promise<void>;

  /** Production: `new PostgresStore(connectionString)` opens a real `pg.Pool`. Tests: inject any
   *  `PgQueryable` (e.g. a PGlite instance via `@caisson/testing`'s `newTestPg().pg`) so the exact
   *  SQL this class issues runs against a real embedded Postgres — the store-parity gate. */
  constructor(connectionStringOrClient: string | PgQueryable) {
    if (typeof connectionStringOrClient === "string") {
      const pool = new Pool({ connectionString: connectionStringOrClient });
      this.client = pool;
      this.onClose = () => pool.end();
    } else {
      this.client = connectionStringOrClient;
      this.onClose = () => Promise.resolve();
    }
  }

  async upsertFinding(finding: Finding, runId: string): Promise<UpsertResult> {
    const f = parseFinding(finding);
    const res = await this.client.query<{ seen_count: number }>(
      `INSERT INTO intel.findings
         (id, source, kind, severity, title, body, dedup_key, run_id, payload)
       VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8::uuid,$9::jsonb)
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
    const res = await this.client.query<{ key: string; value: string }>(
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
    await this.client.query(
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
    const res = await this.client.query<{ dedup_key: string }>(
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
    const res = await this.client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM intel.findings
       WHERE source = $1 AND first_seen >= to_timestamp($2 / 1000.0)`,
      [source, sinceEpochMs],
    );
    return Number(res.rows[0]?.n ?? "0");
  }

  async startRun(watcher: string): Promise<string> {
    const id = crypto.randomUUID();
    await this.client.query(
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
    await this.client.query(
      `UPDATE intel.runs
       SET finished_at = now(), status = $2, findings_count = $3, error = $4
       WHERE id = $1`,
      [runId, status, findingsCount, error ?? null],
    );
  }

  async pruneRuns(): Promise<void> {
    await this.client.query(
      `DELETE FROM intel.runs WHERE started_at < now() - interval '${String(RUN_RETENTION_DAYS)} days'`,
    );
  }

  async checkRoleIsolation(): Promise<boolean> {
    try {
      await this.client.query(`SELECT 1 FROM public.accounts LIMIT 1`);
      return false; // the query SUCCEEDED — the role can read commerce data. Isolation FAILED.
    } catch {
      return true; // expected: permission denied (or the table isn't visible) — isolation holds.
    }
  }

  /** Apply the additive intel-schema migration (idempotent — every statement is IF NOT EXISTS).
   *  Requires DDL privileges the runtime intel_role deliberately does NOT hold — see
   *  migrations/provision-role.sql and the INTEL_MIGRATE_ON_BOOT gate in server.ts/cli.ts. */
  async migrate(): Promise<void> {
    const sql = readFileSync(
      join(import.meta.dir, "../migrations/0001_intel_schema.sql"),
      "utf8",
    );
    await this.client.query(sql);
  }

  async close(): Promise<void> {
    await this.onClose();
  }
}

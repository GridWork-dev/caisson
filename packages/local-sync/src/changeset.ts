// src/sync/changeset.ts — per-tenant changeset capture (ADR-0064/0073). The
// application-layer analog of the SQLite session/changeset extension (which `bun:sqlite` does not
// expose): a per-replica, monotonically-sequenced change log over the canonical local store, plus the
// tenant-partition guard that makes a tenant-A changeset un-appliable to a tenant-B file.
//
// The canonical local store is the authority — the change log MIRRORS local mutations (the edition's
// write path calls `recordUpsert`/`recordDelete` as it writes), and `capture` packages everything
// past a watermark into a tenant-bound, replica-stamped changeset a peer can pull. The reconcile/
// apply/LWW/tombstone halves build on this change log.
//
// Two sync-metadata tables (`sync_meta`, `sync_changelog`) are created idempotently here so capture
// runs standalone; the edition migration assembly folds the same DDL under the ordered, idempotent
// `schema_version` ledger (the sync-metadata columns are migration-versioned + irreversible — no
// rollback past them).
import type { Database } from "bun:sqlite";
import { z } from "zod";
import {
  type JsonValue,
  ValidationError,
  TenancyError,
  parseStrict,
  strictObject,
  canonicalize,
} from "@caisson-sh/kernel";
import type {
  Changeset,
  ChangesetCapture,
  ChangesetEntry,
  ChangeOp,
  RowValues,
} from "./port.ts";

// ── boundary schemas (a changeset arriving from a peer is untrusted input — parse `.strict()`) ──────

/** Recursive JSON value — `.finite()` rejects NaN/Infinity so a parsed value is always canonicalizable. */
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

/** A row's column map — a canonicalizable JSON object. */
const rowValuesSchema: z.ZodType<RowValues> = z.record(
  z.string(),
  jsonValueSchema,
);

/**
 * One changeset entry. The cross-field invariant is fail-closed: an `upsert` MUST carry values and a
 * `delete` MUST NOT — a mismatch is a malformed boundary payload, not a silently-coerced one.
 */
const changesetEntrySchema = strictObject({
  table: z.string().min(1),
  pk: z.string().min(1),
  op: z.enum(["upsert", "delete"]),
  values: rowValuesSchema.nullable(),
  updatedAt: z.number().int().nonnegative(),
  seq: z.number().int().positive(),
}).superRefine((entry, ctx) => {
  if (entry.op === "upsert" && entry.values === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "upsert entry requires values",
    });
  }
  if (entry.op === "delete" && entry.values !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "delete entry must not carry values",
    });
  }
});

const changesetSchema: z.ZodType<Changeset> = strictObject({
  tenantId: z.string().min(1),
  replicaId: z.string().min(1),
  until: z.number().int().nonnegative(),
  entries: z.array(changesetEntrySchema),
}).superRefine((cs, ctx) => {
  for (const entry of cs.entries) {
    if (entry.seq > cs.until) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "entry seq exceeds changeset watermark (until)",
      });
      return;
    }
  }
});

/**
 * Validate an untrusted, peer-supplied changeset at the sync transport boundary. Fail-closed: unknown
 * keys, a bad op/values shape, or an entry past the `until` watermark all throw `ValidationError`
 * (redaction-safe — field paths only, never the rejected values). The tenant-partition check is a
 * SEPARATE step ({@link ChangesetLog.assertApplicable}) — structural validity does not imply the
 * changeset belongs to the receiving tenant's file.
 */
export function parseChangeset(input: unknown): Changeset {
  return parseStrict(changesetSchema, input);
}

// ── the per-tenant change log ───────────────────────────────────────────────────────────────────

const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS sync_meta (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_changelog (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  tbl TEXT NOT NULL,
  pk TEXT NOT NULL,
  op TEXT NOT NULL CHECK (op IN ('upsert','delete')),
  payload TEXT,
  updated_at INTEGER NOT NULL
);
`;

interface MetaRow {
  v: string;
}
interface ChangeRow {
  seq: number;
  tbl: string;
  pk: string;
  op: string;
  payload: string | null;
  updated_at: number;
}
interface MaxRow {
  max_seq: number | null;
}

/**
 * The per-tenant changeset capture seam (the `ChangesetCapture` half of the `SyncEngine` port). One
 * instance is bound to exactly ONE tenant's already-open SQLite file: the file IS the partition
 * boundary (ADR-0073), and `assertApplicable` enforces that an inbound changeset's `tenantId` matches
 * this file before any apply. A stable `replicaId` is minted on first init and persisted in
 * `sync_meta`, so the LWW tiebreak input survives across opens.
 */
export class ChangesetLog implements ChangesetCapture {
  readonly #db: Database;
  readonly #tenantId: string;
  readonly #replicaId: string;
  readonly #now: () => number;

  private constructor(
    db: Database,
    tenantId: string,
    replicaId: string,
    now: () => number,
  ) {
    this.#db = db;
    this.#tenantId = tenantId;
    this.#replicaId = replicaId;
    this.#now = now;
  }

  /** The tenant this log is bound to (the ADR-0073 partition key). */
  get tenantId(): string {
    return this.#tenantId;
  }

  /** This replica's stable id — the deterministic LWW tiebreak input. */
  get replicaId(): string {
    return this.#replicaId;
  }

  /**
   * Open the change log over a tenant's already-resolved SQLite connection. Creates the sync-metadata
   * tables idempotently, then binds `tenantId`: on first use it persists `tenantId` + a fresh
   * `crypto.randomUUID()` replica id; on re-open it asserts the file's stored tenant matches and reuses
   * the replica id. A file already bound to a DIFFERENT tenant fails closed (`TenancyError`) — the
   * file-per-tenant boundary cannot be re-pointed. `now` is injectable for deterministic tests.
   */
  static open(
    db: Database,
    tenantId: string,
    opts: { now?: () => number } = {},
  ): ChangesetLog {
    if (tenantId.length === 0 || tenantId.includes("\0")) {
      throw new ValidationError("changeset log tenantId is invalid", {
        reason: "empty-or-null-byte",
      });
    }
    db.exec(SCHEMA_DDL);

    const existing = db
      .prepare("SELECT v FROM sync_meta WHERE k = 'tenant_id'")
      .get() as MetaRow | null;

    let replicaId: string;
    if (existing === null) {
      // The WebCrypto global, not node:crypto — same UUIDv4 contract, and it keeps this module's
      // value-import graph free of node builtins so the whole `.` barrel stays browser-importable
      // (ADR-0396; `engines.node >= 20.12.0` is the floor that guarantees the global).
      replicaId = crypto.randomUUID();
      db.transaction(() => {
        const insert = db.prepare("INSERT INTO sync_meta(k, v) VALUES (?, ?)");
        insert.run("tenant_id", tenantId);
        insert.run("replica_id", replicaId);
      })();
    } else {
      if (existing.v !== tenantId) {
        // The file belongs to another tenant — a boundary breach, not a lookup miss. Fail closed
        // as a TenancyError (404, never 403) and never echo either tenant id (ADR-0019/0073).
        throw new TenancyError("changeset log tenant mismatch", {
          reason: "tenant-partition",
        });
      }
      const rep = db
        .prepare("SELECT v FROM sync_meta WHERE k = 'replica_id'")
        .get() as MetaRow | null;
      if (rep === null) {
        throw new ValidationError("corrupt sync metadata: missing replica id");
      }
      replicaId = rep.v;
    }

    return new ChangesetLog(db, tenantId, replicaId, opts.now ?? Date.now);
  }

  /**
   * Record an upsert of a row's full column values into the change log (mirroring a canonical-store
   * write). Values are stored as canonical JSON so the captured payload is deterministic.
   */
  recordUpsert(table: string, pk: string, values: RowValues): void {
    this.#append(table, pk, "upsert", canonicalize(values));
  }

  /** Record a delete (a tombstone is later materialized from this). */
  recordDelete(table: string, pk: string): void {
    this.#append(table, pk, "delete", null);
  }

  /**
   * Package every local change with `seq > sinceSeq` into a tenant-bound, replica-stamped changeset.
   * `until` is the highest local sequence — the receiver advances its watermark to it after a clean
   * apply, even when the filtered slice is empty.
   */
  capture(sinceSeq: number): Changeset {
    const watermark = Number.isInteger(sinceSeq) && sinceSeq > 0 ? sinceSeq : 0;
    const rows = this.#db
      .prepare(
        "SELECT seq, tbl, pk, op, payload, updated_at FROM sync_changelog WHERE seq > ? ORDER BY seq ASC",
      )
      .all(watermark) as ChangeRow[];

    const entries: ChangesetEntry[] = rows.map((row) => this.#toEntry(row));

    const max = this.#db
      .prepare("SELECT MAX(seq) AS max_seq FROM sync_changelog")
      .get() as MaxRow | null;
    const until = Math.max(watermark, max?.max_seq ?? 0);

    return {
      tenantId: this.#tenantId,
      replicaId: this.#replicaId,
      until,
      entries,
    };
  }

  /**
   * The tenant-partition guard: a changeset may be applied to this file ONLY if its `tenantId`
   * matches the tenant this log is bound to. A cross-tenant changeset fails closed (`TenancyError`,
   * 404) — a tenant-A changeset can never mutate a tenant-B file (ADR-0073). Apply/reconcile
   * call this before integrating any entry.
   */
  assertApplicable(changeset: Changeset): void {
    if (changeset.tenantId !== this.#tenantId) {
      throw new TenancyError(
        "changeset is not applicable to this tenant file",
        {
          reason: "tenant-partition",
        },
      );
    }
  }

  // --- internal ---

  #append(
    table: string,
    pk: string,
    op: ChangeOp,
    payload: string | null,
  ): void {
    if (table.length === 0 || pk.length === 0) {
      throw new ValidationError(
        "changeset row requires a non-empty table and pk",
      );
    }
    this.#db
      .prepare(
        "INSERT INTO sync_changelog(tbl, pk, op, payload, updated_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(table, pk, op, payload, this.#now());
  }

  #toEntry(row: ChangeRow): ChangesetEntry {
    const op: ChangeOp = row.op === "delete" ? "delete" : "upsert";
    let values: RowValues | null = null;
    if (op === "upsert") {
      if (row.payload === null) {
        throw new ValidationError("corrupt change log: upsert without payload");
      }
      // JSON.parse returns `any`; parseStrict re-validates it back into a typed RowValues.
      values = parseStrict(rowValuesSchema, JSON.parse(row.payload));
    }
    return {
      table: row.tbl,
      pk: row.pk,
      op,
      values,
      updatedAt: row.updated_at,
      seq: row.seq,
    };
  }
}

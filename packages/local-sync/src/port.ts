// src/sync/port.ts — the SyncEngine PORT (ADR-0064). The pure contract for the
// two-way sync engine: capture the local replica's changes, apply a peer's changes, reconcile
// concurrent divergence toward the canonical local store. NO logic, NO I/O, NO SDK lives here — only
// the types the change log (capture), the LWW/CRDT merge, and tombstone persistence implement against.
// The local canonical store is the convergence target; sync moves peers toward it.
//
// Why an in-house changeset analog and not the SQLite session extension: `bun:sqlite` does not expose
// `sqlite3session_*`, so the edition records row-level changes at the application layer (the same
// shape the C extension produces — a per-replica, monotonically-sequenced change log). A changeset is
// bound to exactly ONE tenant's file (ADR-0073): the `tenantId` IS the partition key, so a tenant-A
// changeset can never apply to a tenant-B file.
import type { JsonValue } from "@caisson-sh/kernel";

/** A row change is either an upsert (full column values) or a delete (later materialized as a tombstone). */
export type ChangeOp = "upsert" | "delete";

/** A single row's column values — a canonicalizable JSON object (`canonicalize`-compatible). */
export type RowValues = { readonly [column: string]: JsonValue };

/**
 * One row-level change captured from the canonical local store. `values` carries the full column set
 * for an `upsert` and is `null` for a `delete`. `updatedAt` is the wall-clock-ms LWW input seam — the
 * hybrid logical clock (`clock.ts`) layers a deterministic, non-forgeable tiebreak on top of it; it is
 * NOT the authority on its own.
 */
export interface RowChange {
  readonly table: string;
  readonly pk: string;
  readonly op: ChangeOp;
  readonly values: RowValues | null;
  readonly updatedAt: number;
}

/** A captured change plus its monotonic per-replica sequence — the sync watermark unit. */
export interface ChangesetEntry extends RowChange {
  /** Strictly-increasing per-replica sequence (the change-log rowid). The receiver's watermark. */
  readonly seq: number;
}

/**
 * A changeset: the set of row changes one replica emits for a peer. Bound to a single tenant's file
 * (`tenantId`, the ADR-0073 partition key) and stamped with the
 * originating `replicaId` (the deterministic LWW tiebreak input). `until` is the highest local
 * sequence this changeset covers — the receiver advances its watermark to it after a clean apply.
 */
export interface Changeset {
  readonly tenantId: string;
  readonly replicaId: string;
  readonly until: number;
  readonly entries: readonly ChangesetEntry[];
}

/** The outcome of applying a peer changeset. */
export interface ApplyResult {
  readonly applied: number;
  readonly skipped: number;
}

/** The outcome of reconciling concurrent divergence. */
export interface ReconcileResult {
  readonly applied: number;
  readonly conflicts: number;
}

/** The capture half of the port — implemented by the change log (`ChangesetLog`). */
export interface ChangesetCapture {
  /** Package every local change with `seq > sinceSeq` into a tenant-bound, replica-stamped changeset. */
  capture(sinceSeq: number): Changeset;
}

/**
 * The full two-way sync engine. `capture` emits local changes; `apply` integrates a peer's
 * changeset after the tenant-partition guard; `reconcile` resolves concurrent per-field
 * divergence toward the canonical local store. The concrete engine implementing `apply`/
 * `reconcile` lands on the critical path after capture.
 */
export interface SyncEngine extends ChangesetCapture {
  apply(remote: Changeset): ApplyResult;
  reconcile(remote: Changeset): ReconcileResult;
}

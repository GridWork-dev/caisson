// Deterministic in-browser mirror of the @caisson/local-sync reconciliation primitive for the
// "Converge two devices" poke (ADR-0378 lock 2). The real merge (packages/local-sync/src/reconcile.ts
// + tombstone.ts + clock.ts) is plain TypeScript with no browser-hostile calls of its own, but the
// package exposes it only through a barrel that also exports `ChangesetLog` from changeset.ts, which
// reaches `bun:sqlite` and `node:crypto`. That barrel cannot enter the browser bundle — the same
// barrel-versus-safe-entry constraint documented by audit-worm-poke.tsx. So the merge is mirrored
// here verbatim — no hashing is involved in this primitive,
// so no WebCrypto is needed either, only the same comparisons and folds the real functions perform —
// and local-sync-logic.test.ts pins every mirrored output byte-identical to the real package under bun,
// plus the shipped packages/local-sync/src/__golden__ fixtures. Nothing here fetches, persists, or
// measures — pure functions over baked sample data.
//
// Sources mirrored: packages/local-sync/src/port.ts (Changeset/ChangesetEntry/ChangeOp/RowValues),
// packages/local-sync/src/clock.ts (HlcStamp/compareStamps/stampFromEntry),
// packages/local-sync/src/reconcile.ts (reconcileReplicas/ReconciledRow),
// packages/local-sync/src/tombstone.ts (Tombstone/TombstoneReconcileResult/reconcileWithTombstones).

/** A JSON-serializable value (mirror of port.ts's `JsonValue` re-export from @caisson/kernel). */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** Mirror of port.ts `ChangeOp`. */
export type ChangeOp = "upsert" | "delete";

/** Mirror of port.ts `RowValues`. */
export type RowValues = { readonly [column: string]: JsonValue };

/** Mirror of port.ts `ChangesetEntry`. */
export interface ChangesetEntry {
  readonly table: string;
  readonly pk: string;
  readonly op: ChangeOp;
  readonly values: RowValues | null;
  readonly updatedAt: number;
  readonly seq: number;
}

/** Mirror of port.ts `Changeset`. */
export interface Changeset {
  readonly tenantId: string;
  readonly replicaId: string;
  readonly until: number;
  readonly entries: readonly ChangesetEntry[];
}

/** Mirror of clock.ts `HlcStamp`. */
export interface HlcStamp {
  readonly physical: number;
  readonly node: string;
  readonly counter: number;
}

/** Mirror of clock.ts `stampFromEntry`. */
export function stampFromEntry(
  entry: ChangesetEntry,
  replicaId: string,
): HlcStamp {
  return { physical: entry.updatedAt, node: replicaId, counter: entry.seq };
}

/** Mirror of clock.ts `compareStamps` — the strict total order the LWW winner is chosen by. */
export function compareStamps(a: HlcStamp, b: HlcStamp): number {
  if (a.physical !== b.physical) return a.physical < b.physical ? -1 : 1;
  if (a.node !== b.node) return a.node < b.node ? -1 : 1;
  if (a.counter !== b.counter) return a.counter < b.counter ? -1 : 1;
  return 0;
}

/**
 * Tenant-partition mismatch. The real functions throw kernel's `TenancyError`; this browser mirror
 * throws a local class (no kernel import). The parity test checks that both this path and the
 * relative-imported package path fail with their respective classes, following the relative-source
 * convention in audit-worm-poke.test.ts.
 */
export class TenantPartitionError extends Error {}

/** Mirror of reconcile.ts `ReconciledRow`. */
export interface ReconciledRow {
  readonly table: string;
  readonly pk: string;
  readonly values: RowValues;
}

interface Winner {
  readonly entry: ChangesetEntry;
  readonly stamp: HlcStamp;
}

function assertOneTenant(changesets: readonly Changeset[]): string | undefined {
  let tenantId: string | undefined;
  for (const cs of changesets) {
    if (tenantId === undefined) {
      tenantId = cs.tenantId;
    } else if (cs.tenantId !== tenantId) {
      throw new TenantPartitionError(
        "cannot reconcile changesets across tenants",
      );
    }
  }
  return tenantId;
}

function sortRows<T extends { readonly table: string; readonly pk: string }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) =>
    a.table < b.table
      ? -1
      : a.table > b.table
        ? 1
        : a.pk < b.pk
          ? -1
          : a.pk > b.pk
            ? 1
            : 0,
  );
}

/** Mirror of reconcile.ts `reconcileReplicas` — the pure LWW merge core, order-independent. */
export function reconcileReplicas(
  changesets: readonly Changeset[],
): ReconciledRow[] {
  assertOneTenant(changesets);

  const winners = new Map<string, Map<string, Winner>>();
  for (const cs of changesets) {
    for (const entry of cs.entries) {
      const stamp = stampFromEntry(entry, cs.replicaId);
      let byPk = winners.get(entry.table);
      if (byPk === undefined) {
        byPk = new Map<string, Winner>();
        winners.set(entry.table, byPk);
      }
      const current = byPk.get(entry.pk);
      if (current === undefined || compareStamps(stamp, current.stamp) > 0) {
        byPk.set(entry.pk, { entry, stamp });
      }
    }
  }

  const rows: ReconciledRow[] = [];
  for (const [table, byPk] of winners) {
    for (const [pk, winner] of byPk) {
      const { entry } = winner;
      if (entry.op === "upsert" && entry.values !== null) {
        rows.push({ table, pk, values: entry.values });
      }
    }
  }
  return sortRows(rows);
}

/** Mirror of tombstone.ts `Tombstone`. */
export interface Tombstone {
  readonly table: string;
  readonly pk: string;
  readonly stamp: HlcStamp;
}

/** Mirror of tombstone.ts `TombstoneReconcileResult`. */
export interface TombstoneReconcileResult {
  readonly live: ReconciledRow[];
  readonly tombstones: Tombstone[];
}

interface WinningChange {
  readonly op: ChangeOp;
  readonly stamp: HlcStamp;
}

function tombstonesToChangesets(
  prior: readonly Tombstone[],
  tenantId: string,
): Changeset[] {
  const byNode = new Map<string, ChangesetEntry[]>();
  for (const t of prior) {
    const entry: ChangesetEntry = {
      table: t.table,
      pk: t.pk,
      op: "delete",
      values: null,
      updatedAt: t.stamp.physical,
      seq: t.stamp.counter,
    };
    const entries = byNode.get(t.stamp.node);
    if (entries === undefined) {
      byNode.set(t.stamp.node, [entry]);
    } else {
      entries.push(entry);
    }
  }
  const out: Changeset[] = [];
  for (const [node, entries] of byNode) {
    let until = 0;
    for (const e of entries) until = Math.max(until, e.seq);
    out.push({ tenantId, replicaId: node, until, entries });
  }
  return out;
}

function advanceTombstones(
  prior: readonly Tombstone[],
  changesets: readonly Changeset[],
): Tombstone[] {
  const winners = new Map<string, Map<string, WinningChange>>();
  const consider = (
    table: string,
    pk: string,
    op: ChangeOp,
    stamp: HlcStamp,
  ): void => {
    let byPk = winners.get(table);
    if (byPk === undefined) {
      byPk = new Map<string, WinningChange>();
      winners.set(table, byPk);
    }
    const current = byPk.get(pk);
    if (current === undefined || compareStamps(stamp, current.stamp) > 0) {
      byPk.set(pk, { op, stamp });
    }
  };

  for (const t of prior) consider(t.table, t.pk, "delete", t.stamp);
  for (const cs of changesets) {
    for (const entry of cs.entries) {
      consider(
        entry.table,
        entry.pk,
        entry.op,
        stampFromEntry(entry, cs.replicaId),
      );
    }
  }

  const out: Tombstone[] = [];
  for (const [table, byPk] of winners) {
    for (const [pk, winner] of byPk) {
      if (winner.op === "delete") out.push({ table, pk, stamp: winner.stamp });
    }
  }
  return sortRows(out);
}

/**
 * Mirror of tombstone.ts `reconcileWithTombstones` — composes `reconcileReplicas` for the live set
 * (prior tombstones replayed as synthetic deletes, so a stale upsert still loses to a persisted
 * delete) and folds the greatest-stamped delete per key into the advanced tombstone set.
 */
export function reconcileWithTombstones(
  prior: readonly Tombstone[],
  changesets: readonly Changeset[],
): TombstoneReconcileResult {
  const tenantId = assertOneTenant(changesets);

  if (tenantId === undefined) {
    return { live: [], tombstones: sortRows(prior) };
  }

  const synthetic = tombstonesToChangesets(prior, tenantId);
  const live = reconcileReplicas([...synthetic, ...changesets]);
  const tombstones = advanceTombstones(prior, changesets);
  return { live, tombstones };
}

// --- The poke model (baked sample data + state operations) ---
//
// Sample scenario: the exact two-replica "docs" table divergence packages/local-sync/src/
// reconcile.test.ts pins as its tombstone golden (TOMB_A/TOMB_B → __golden__/tombstone-resolve.json),
// extended with one straggler entry (B's clock-behind third edit) to exercise the ACROSS-ROUNDS
// tombstone persistence tombstone.test.ts pins — the part plain `reconcileReplicas` cannot show,
// because a delete already wins within a single batch regardless of tombstone persistence.

/** Sample tenant id for this poke (labeled "sample" in the UI — not a real tenant). */
export const TENANT_ID = "tenant-demo";
export const REPLICA_A = "replica-a";
export const REPLICA_B = "replica-b";

/** Replica A's fixed offline queue: create e1, create e3, then delete e1. */
export const A_QUEUE: readonly ChangesetEntry[] = [
  {
    table: "docs",
    pk: "e1",
    op: "upsert",
    values: { title: "e1-A" },
    updatedAt: 3000,
    seq: 1,
  },
  {
    table: "docs",
    pk: "e3",
    op: "upsert",
    values: { title: "e3-A" },
    updatedAt: 3001,
    seq: 2,
  },
  {
    table: "docs",
    pk: "e1",
    op: "delete",
    values: null,
    updatedAt: 3010,
    seq: 3,
  },
];

/** Replica B's fixed offline queue: create e1 (concurrently), create e2. */
export const B_QUEUE: readonly ChangesetEntry[] = [
  {
    table: "docs",
    pk: "e1",
    op: "upsert",
    values: { title: "e1-B" },
    updatedAt: 3005,
    seq: 1,
  },
  {
    table: "docs",
    pk: "e2",
    op: "upsert",
    values: { title: "e2-B" },
    updatedAt: 3006,
    seq: 2,
  },
];

/**
 * A late, clock-behind edit Replica B still had queued from before the first sync (physical 3002 is
 * older than A's delete at 3010, but its `seq` — 3 — is newer than anything already delivered).
 */
export const B_STALE_ENTRY: ChangesetEntry = {
  table: "docs",
  pk: "e1",
  op: "upsert",
  values: { title: "e1-B-stale" },
  updatedAt: 3002,
  seq: 3,
};

export interface PokeState {
  /** How many of A_QUEUE have been applied, 0..A_QUEUE.length. */
  readonly appliedA: number;
  /** How many of B_QUEUE have been applied, 0..B_QUEUE.length. */
  readonly appliedB: number;
  /** Whether Replica B's straggler edit has been delivered (a second sync round). */
  readonly staleDelivered: boolean;
  /** Whether the straggler round carries forward the first round's persisted tombstones. */
  readonly persistTombstones: boolean;
}

export const initialPokeState: PokeState = {
  appliedA: 0,
  appliedB: 0,
  staleDelivered: false,
  persistTombstones: true,
};

function changesetFor(
  replicaId: string,
  entries: readonly ChangesetEntry[],
): Changeset {
  let until = 0;
  for (const e of entries) until = Math.max(until, e.seq);
  return { tenantId: TENANT_ID, replicaId, until, entries };
}

export interface ConvergeResult {
  /** The first-round merge: A's + B's applied edits, no prior tombstones. */
  readonly round1: TombstoneReconcileResult;
  /** round1 recomputed with the replicas merged in the opposite order — must match. */
  readonly orderIndependent: boolean;
  /** The second round (only Replica B's straggler edit), once delivered; else null. */
  readonly round2: TombstoneReconcileResult | null;
}

function rowsEqual(
  a: readonly ReconciledRow[],
  b: readonly ReconciledRow[],
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function tombstonesEqual(
  a: readonly Tombstone[],
  b: readonly Tombstone[],
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Run the merge for the current poke state. Pure — same state always converges the same way. */
export function converge(state: PokeState): ConvergeResult {
  const csA = changesetFor(REPLICA_A, A_QUEUE.slice(0, state.appliedA));
  const csB = changesetFor(REPLICA_B, B_QUEUE.slice(0, state.appliedB));
  const round1 = reconcileWithTombstones([], [csA, csB]);
  const round1Reversed = reconcileWithTombstones([], [csB, csA]);
  const orderIndependent =
    rowsEqual(round1.live, round1Reversed.live) &&
    tombstonesEqual(round1.tombstones, round1Reversed.tombstones);

  let round2: TombstoneReconcileResult | null = null;
  if (state.staleDelivered) {
    const csB2 = changesetFor(REPLICA_B, [B_STALE_ENTRY]);
    const prior = state.persistTombstones ? round1.tombstones : [];
    round2 = reconcileWithTombstones(prior, [csB2]);
  }
  return { round1, orderIndependent, round2 };
}

export type VerdictState = "ok" | "fail" | "neutral";

export interface PokeVerdict {
  readonly state: VerdictState;
  readonly text: string;
}

/** The value shown for a converged row's title field, or a placeholder if the row has none. */
export function titleOf(row: ReconciledRow): string {
  const value = row.values.title;
  return typeof value === "string" ? value : "(no title)";
}

/**
 * The headline verdict: computed from the merge, never asserted copy. No em dashes (ADR-0375).
 */
export function verdictFor(
  state: PokeState,
  result: ConvergeResult,
): PokeVerdict {
  if (state.appliedA === 0 && state.appliedB === 0) {
    return {
      state: "neutral",
      text: "Apply offline edits on both replicas, then converge.",
    };
  }
  if (!result.orderIndependent) {
    return {
      state: "fail",
      text: "Merge order changed the result. Convergence broke.",
    };
  }
  if (result.round2 !== null) {
    const e1 = result.round2.live.find((r) => r.pk === "e1");
    if (e1 !== undefined) {
      return {
        state: "fail",
        text: `Resurrection. e1 came back as "${titleOf(e1)}". The delete was forgotten.`,
      };
    }
    return {
      state: "ok",
      text: "Converged. The persisted tombstone held; the stale edit lost.",
    };
  }
  return {
    state: "ok",
    text: "Converged. Both replicas agree on one state.",
  };
}

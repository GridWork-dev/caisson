// src/sync/reconcile.ts — the LWW/CRDT merge core (ADR-0064; pins the sync-conflict goldens). A
// PURE, DETERMINISTIC reduction over the per-replica changelogs of ONE tenant (file-per-tenant,
// ADR-0073 — every changeset shares a `tenantId`, replicas differ only by `replicaId`) into the
// converged set of LIVE rows. The local canonical store is the convergence target: after a sync
// round-trip both replicas reach exactly this set.
//
// The merge is a last-writer-wins register per `(table, pk)`, keyed by the hybrid logical clock
// (`clock.ts`): the winning change is the one with the greatest `HlcStamp` — physical (`updatedAt`)
// then node (`replicaId`) then counter (`seq`). Because `replicaId` is a non-forgeable per-replica UUID,
// the winner is unambiguous and input-order-independent (`reconcileReplicas([A,B]) === [B,A]`), so a
// skewed/forged wall clock cannot make convergence non-deterministic. A `delete` that wins is
// a tombstone: the row is EXCLUDED from the live set and a lower-keyed concurrent `upsert` does NOT
// resurrect it. `tombstone.ts` layers persistence + horizon GC on top; this core already enforces
// no-resurrection by construction (a losing upsert is simply not the winner).
//
// Boundary note: this is the pure merge core, not the untrusted transport boundary — peer changesets are
// Zod-`.strict()`-parsed at ingress (`changeset.ts:parseChangeset`) and tenant-partition-checked by the
// engine (`ChangesetLog.assertApplicable`) before reaching here. The cross-tenant guard below is
// defense-in-depth: a caller bug that mixed two tenants' files fails closed rather than silently merging.
import type { Changeset, ChangesetEntry, RowValues } from "./port.ts";
import { TenancyError } from "@caisson-sh/kernel";
import { compareStamps, stampFromEntry, type HlcStamp } from "./clock.ts";

/**
 * One converged live row: the winning `upsert`'s full column values for a `(table, pk)`. The reconciled
 * set is sorted ascending by `table` then `pk`, so two replicas serialize byte-equal.
 */
export interface ReconciledRow {
  readonly table: string;
  readonly pk: string;
  readonly values: RowValues;
}

/** The per-(table, pk) LWW register: the current winning change plus its precomputed HLC stamp. */
interface Winner {
  readonly entry: ChangesetEntry;
  readonly stamp: HlcStamp;
}

/**
 * Reconcile the per-replica changelogs of one tenant into the converged set of live rows. Pure and
 * deterministic: the result depends only on the changesets' content, never on their order. LWW per
 * `(table, pk)` by greatest HLC stamp; a winning `delete` tombstones the row (excluded, no resurrection).
 *
 * Fails closed with `TenancyError` (404, never 403 — never echo a tenant id) if the changesets do not all
 * share one `tenantId`: a cross-tenant merge is a partition breach (ADR-0073), not a no-op.
 */
export function reconcileReplicas(
  changesets: readonly Changeset[],
): ReconciledRow[] {
  // Defense-in-depth: all replicas must belong to the same tenant file (the ADR-0073 partition).
  let tenantId: string | undefined;
  for (const cs of changesets) {
    if (tenantId === undefined) {
      tenantId = cs.tenantId;
    } else if (cs.tenantId !== tenantId) {
      throw new TenancyError("cannot reconcile changesets across tenants", {
        reason: "tenant-partition",
      });
    }
  }

  // LWW register per (table, pk): keep the change with the greatest HLC stamp.
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

  // Materialize the live set: a winning delete is a tombstone (excluded — no resurrection by a loser).
  const rows: ReconciledRow[] = [];
  for (const [table, byPk] of winners) {
    for (const [pk, winner] of byPk) {
      const { entry } = winner;
      if (entry.op === "upsert" && entry.values !== null) {
        rows.push({ table, pk, values: entry.values });
      }
    }
  }

  // Total-order the live set by (table, pk) so divergent replicas serialize byte-equal.
  rows.sort((a, b) =>
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
  return rows;
}

// src/sync/tombstone.ts — durable tombstone persistence + horizon GC (ADR-0064). The
// PERSISTENCE layer the single-batch merge (`reconcile.ts`) explicitly defers: `reconcileReplicas`
// already excludes a winning delete within ONE batch (a losing concurrent upsert is simply not the
// winner — no resurrection by construction), but real sync is incremental. A replica does not keep
// every peer changeset forever; it keeps a watermark plus a TOMBSTONE SET. So when a later batch
// arrives that no longer carries the original delete, the persisted tombstone must STILL outrank a
// stale, lower-stamped upsert — otherwise the row resurrects.
//
// This module COMPOSES `reconcileReplicas`, it does not rebuild it:
//   - the LIVE set is delegated verbatim to `reconcileReplicas` — prior tombstones are replayed as
//     synthetic delete entries (the HLC stamp is losslessly reversible to its originating change), so
//     the live-set semantics are LITERALLY `reconcileReplicas`'s and follow any future change to it for free;
//   - the only genuinely-new state is the tombstone INDEX (the greatest-stamped delete per `(table, pk)`)
//     and its horizon GC. Both reuse the `clock.ts` total order — no clock logic is re-implemented here.
//
// Re-creation is allowed: a strictly-greater-stamped upsert beats a tombstone (the row legitimately
// comes back AND the tombstone is cleared). GC drops tombstones older than a horizon — safe ONLY once
// every replica has observed the delete; collecting earlier would let a still-un-synced stale upsert
// resurrect the row, so the horizon MUST exceed the slowest replica's un-synced-edit lag.
import type { Changeset, ChangeOp, ChangesetEntry } from "./port.ts";
import { reconcileReplicas, type ReconciledRow } from "./reconcile.ts";
import { compareStamps, stampFromEntry, type HlcStamp } from "./clock.ts";
import { TenancyError } from "@caisson-sh/kernel";

/**
 * A durable record that `(table, pk)` was deleted at HLC `stamp`. Persisted across sync rounds (one per
 * key, the greatest-stamped delete): it suppresses any later upsert whose stamp is not strictly greater,
 * so a stale peer edit cannot resurrect a deleted row. Tenant-agnostic by construction — the
 * set lives inside one tenant's file (file-per-tenant, ADR-0073), so the tenant is the file, not the row.
 */
export interface Tombstone {
  readonly table: string;
  readonly pk: string;
  readonly stamp: HlcStamp;
}

/**
 * The persistent reconcile outcome: the converged LIVE rows (winning upserts, delete-excluded — the
 * `reconcileReplicas` shape) plus the ADVANCED tombstone set to persist for the next round. Both are
 * total-ordered by `(table, pk)` so two replicas serialize byte-equal.
 */
export interface TombstoneReconcileResult {
  readonly live: ReconciledRow[];
  readonly tombstones: Tombstone[];
}

/** The per-(table, pk) winner while folding the tombstone index: the current op + its HLC stamp. */
interface WinningChange {
  readonly op: ChangeOp;
  readonly stamp: HlcStamp;
}

/**
 * Reconcile new per-tenant changesets over a PERSISTED tombstone set. Prior tombstones participate in
 * the merge as virtual deletes, so a stale upsert whose original delete is no longer in the batch still
 * loses to the tombstone → no resurrection across sync rounds. Pure and deterministic: the
 * result depends only on the inputs' content, never on changeset order.
 *
 * Returns the converged live rows (delegated to `reconcileReplicas`, so the live semantics are
 * exactly the single-batch merge's) and the advanced tombstone set (the greatest-stamped delete per key;
 * a key re-created by a strictly-greater upsert drops out of the set).
 *
 * Fails closed with `TenancyError` (404, never 403 — never echo a tenant id) if the changesets do not all
 * share one `tenantId`: a cross-tenant merge is a partition breach (ADR-0073), not a no-op.
 */
export function reconcileWithTombstones(
  prior: readonly Tombstone[],
  changesets: readonly Changeset[],
): TombstoneReconcileResult {
  // Defense-in-depth: all replicas must belong to the same tenant file (the ADR-0073 partition).
  // `reconcileReplicas` re-checks this over the combined set; we derive the tenant here to anchor the
  // synthetic tombstone changesets to it.
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

  // No new changes (`tenantId` undefined ⇔ no changesets): there is no tenant to anchor synthetic
  // deletes to and no upsert to make live — the live set is empty and the persisted tombstones carry
  // forward unchanged (just re-ordered). This also narrows `tenantId` to a string below, no cast needed.
  if (tenantId === undefined) {
    return { live: [], tombstones: sortTombstones(prior) };
  }

  const synthetic = tombstonesToChangesets(prior, tenantId);

  // LIVE set: delegate verbatim to `reconcileReplicas`. Replaying tombstones as synthetic deletes makes a stale,
  // lower-stamped upsert lose to the persisted delete (excluded — no resurrection); a strictly-greater
  // upsert beats the synthetic delete and is re-created. We do NOT re-implement the merge.
  const live = reconcileReplicas([...synthetic, ...changesets]);

  // TOMBSTONE index: the only new state. Fold prior tombstones (as deletes) + the real entries, keep the
  // greatest-stamped change per key, and retain those whose winner is a delete.
  const tombstones = advanceTombstones(prior, changesets);

  return { live, tombstones };
}

/**
 * Garbage-collect tombstones older than `horizon` (a physical-clock-ms watermark): a tombstone is kept
 * iff `stamp.physical >= horizon`, dropped otherwise. Pure — returns a new sorted set.
 *
 * SAFETY CONTRACT: `horizon` MUST be older than the oldest edit any replica could still hold un-synced
 * (the sync convergence horizon). Collecting a tombstone before every replica has observed its delete
 * would let a still-pending stale upsert resurrect the row — GC trades storage for a resurrection window,
 * so the horizon is the floor below which all replicas are provably converged, never "now".
 */
export function gcTombstones(
  tombstones: readonly Tombstone[],
  horizon: number,
): Tombstone[] {
  return sortTombstones(tombstones.filter((t) => t.stamp.physical >= horizon));
}

// --- internal ---

/**
 * Rebuild prior tombstones as synthetic delete changesets so `reconcileReplicas` can replay them.
 * The HLC stamp is losslessly reversible to the change that produced it (`stampFromEntry`): `physical →
 * updatedAt`, `node → replicaId`, `counter → seq`. Grouped by node so each synthetic changeset carries a
 * single originating replica's deletes, exactly as a captured changeset would.
 */
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

/**
 * Advance the persisted tombstone set: fold prior tombstones (as virtual deletes) and the real entries
 * into the greatest-stamped change per `(table, pk)` via the `clock.ts` total order, then keep only the
 * keys whose winner is a `delete`. A key whose winner is an upsert (a strictly-newer re-creation) drops
 * out of the set. Deterministic and order-independent — the winner is selected by `compareStamps`.
 */
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
  return sortTombstones(out);
}

/** Total-order tombstones by `(table, pk)` so divergent replicas serialize byte-equal. */
function sortTombstones(tombstones: readonly Tombstone[]): Tombstone[] {
  return [...tombstones].sort((a, b) =>
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

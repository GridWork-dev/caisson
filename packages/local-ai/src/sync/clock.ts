// src/sync/clock.ts — the hybrid logical clock (HLC) for sync reconciliation (ADR-0064).
// A captured change carries a `updatedAt` wall-clock-ms HINT, but a peer's wall clock is
// skewable and forgeable, so it is NEVER the sole authority. The HLC stamp layers two non-forgeable,
// deterministic components on top of that hint:
//
//   physical — the `updatedAt` wall-clock-ms hint (a peer-supplied input; ordering signal, not authority)
//   node     — the originating `replicaId` (a stable per-replica UUID minted locally in `sync_meta`
//              — a peer cannot mint another replica's id to win a tie)
//   counter  — the per-replica monotonic change-log `seq` (disambiguates same-node, same-physical events)
//
// `compareStamps` is a STRICT TOTAL ORDER over these three: physical first, then node, then counter.
// Because `node` is globally unique per replica, two distinct replicas never produce an ambiguous tie —
// so the LWW winner (`reconcile.ts`) is fully deterministic and order-independent. Convergence does
// not depend on which replica observed a change first, nor on re-reading a local wall clock; a skewed or
// forged `updatedAt` cannot make the merge non-deterministic, only bias the physical leg of a true
// concurrent edit — and that bias is itself bounded and tie-broken by the non-forgeable `node`/`counter`.
import type { ChangesetEntry } from "./port.ts";

/**
 * A hybrid logical clock timestamp — the LWW comparison key for one captured row change. Ordered by
 * `compareStamps`: greater wins. `physical` is the non-authoritative wall-clock hint; `node` + `counter`
 * are the deterministic, non-forgeable tiebreak that makes reconciliation converge identically on every
 * replica regardless of clock skew.
 */
export interface HlcStamp {
  /** The `updatedAt` wall-clock-ms hint. An ordering signal only — never the sole authority. */
  readonly physical: number;
  /** The originating `replicaId` (stable per-replica UUID) — the non-forgeable deterministic tiebreak. */
  readonly node: string;
  /** The per-replica monotonic change-log `seq` — disambiguates same-node, same-physical events. */
  readonly counter: number;
}

/**
 * Derive the HLC stamp for one captured change. The entry supplies the physical hint (`updatedAt`) and
 * the per-replica counter (`seq`); the changeset's `replicaId` supplies the node. Pure — the stamp is a
 * function of the captured change alone, so the same change always stamps identically on every replica.
 */
export function stampFromEntry(
  entry: ChangesetEntry,
  replicaId: string,
): HlcStamp {
  return { physical: entry.updatedAt, node: replicaId, counter: entry.seq };
}

/**
 * Strict total order over HLC stamps: `< 0` when `a` precedes `b`, `> 0` when `a` follows `b`, `0` only
 * for an identical `(physical, node, counter)`. The greater stamp is the last writer. Compared physical
 * → node → counter: a higher wall-clock hint wins; an exact-physical tie is broken by the
 * lexicographically greater `node` (a peer cannot forge another replica's id); a same-node, same-physical
 * tie is broken by the greater `counter` (`seq`, monotonic within that replica). Deterministic and
 * transitive — two replicas merging the same change set always agree on the winner.
 */
export function compareStamps(a: HlcStamp, b: HlcStamp): number {
  if (a.physical !== b.physical) return a.physical < b.physical ? -1 : 1;
  if (a.node !== b.node) return a.node < b.node ? -1 : 1;
  if (a.counter !== b.counter) return a.counter < b.counter ? -1 : 1;
  return 0;
}

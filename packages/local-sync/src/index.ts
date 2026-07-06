export { ChangesetLog, parseChangeset } from "./changeset.ts";
export { reconcileReplicas, type ReconciledRow } from "./reconcile.ts";
export {
  reconcileWithTombstones,
  gcTombstones,
  type Tombstone,
  type TombstoneReconcileResult,
} from "./tombstone.ts";
export { compareStamps, stampFromEntry, type HlcStamp } from "./clock.ts";
export type {
  Changeset,
  ChangesetEntry,
  ChangesetCapture,
  ChangeOp,
  RowChange,
  RowValues,
  ApplyResult,
  ReconcileResult,
  SyncEngine,
} from "./port.ts";

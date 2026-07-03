export {
  ERASURE_REASONS,
  erasureReasonSchema,
  erasureRequestSchema,
} from "./types.ts";
export type {
  ErasureReason,
  ErasureRequest,
  TargetResult,
  RetentionRunResult,
} from "./types.ts";

export {
  createCaptureTarget,
  createObjectStorageTarget,
  createCascadeDbTarget,
  createOrphanSweepTarget,
} from "./targets.ts";
export type {
  ErasureTarget,
  CaptureTarget,
  ObjectStorageClient,
  CascadeDbClient,
  OrphanSweepClient,
} from "./targets.ts";

export { createCaptureAuditSink } from "./audit-sink.ts";
export type { RetentionAuditSink, CaptureAuditSink } from "./audit-sink.ts";

export { runErasure } from "./run-erasure.ts";

export {
  AUTO_90D_SWEEP_TASK,
  autoSweepPayloadSchema,
  defineRetentionTask,
  enqueueAutoSweep,
} from "./schedule.ts";
export type { AutoSweepPayload, RetentionTaskDeps } from "./schedule.ts";

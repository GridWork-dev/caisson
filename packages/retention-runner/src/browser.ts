// The browser-safe entry (`@caisson-sh/retention-runner/browser`, ADR-0396): the request/result
// contract, the `ErasureTarget` port with its three reference drivers, the audit-sink port with its
// in-memory driver, and `runErasure` itself. In other words `.` minus `./schedule.ts`, whose
// `@caisson-sh/jobs` edge reaches `node:crypto` through three queue drivers — a job queue is not a
// thing a client bundle runs, so nothing is lost.
//
// ADDITIVE: `.` is untouched and keeps the full surface; every name here is also on `.`
// (browser-safety.test.ts pins the subset direction, one-way). The duplicated export lines are the
// price of leaving `.` provably unchanged — the subset test is the drift guard.
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

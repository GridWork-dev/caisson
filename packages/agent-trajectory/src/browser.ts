// The browser-safe entry (`@caisson-sh/agent-trajectory/browser`, ADR-0396): the whole trajectory
// contract MINUS the two Postgres-backed store implementations — the strict event schema, the
// in-memory append-only store, the durable run-state port with its in-memory implementation, both
// deterministic projections, and the Claude-transcript adapter. ADDITIVE: `.` is untouched for
// adopters and stays the full node-capable surface.
//
// This file is the SINGLE list of the shared half — `src/index.ts` re-exports it and adds only the
// two PG exports — so `.` is a superset of `./browser` by construction and cannot drift on a later
// edit. `src/browser-safety.test.ts` pins the direction anyway (a structural guarantee still wants
// an assertion, since a future edit could reintroduce a second list).
//
// DELIBERATELY EXCLUDED, so the next reader does not "complete" this entry:
//   - store.pg.ts + run-state.pg.ts — the PG implementations. They value-import
//     `@caisson-sh/tenancy-rls` and `@caisson-sh/field-crypto` (node:crypto, node:async_hooks) plus the
//     `pg` driver, so their graphs fail the admission walk irreducibly.
//   - `RunStateCryptoContextRunner` — the type half of run-state.pg.ts. Erased at emit, so it COULD
//     ride along, but it describes a Postgres transaction runner and has no browser meaning; it
//     stays on `.` alone.
export {
  TrajectoryEvent,
  DigestRef,
  BillingStatus,
  EVENT_KINDS,
  TRAJECTORY_VERSION,
} from "./schema.ts";
export { createMemoryTrajectoryStore, type TrajectoryStore } from "./store.ts";
// The durable run-state port (ADR-0360 U-3, S3): park/approve/deny/claimResume/finish, CAS-guarded.
export {
  createMemoryRunStateStore,
  type TransitionResult,
  type ParkInput,
  type RunResumeMaterial,
  type RunStateSnapshot,
  type RunStateStore,
  type RunStatus,
} from "./run-state.ts";
export {
  project,
  type RunProjection,
  type StepNode,
  type UsageTotal,
  type CheckpointMark,
  projectToolCalls,
  type ToolCallProjection,
  type ToolCallApproval,
  type ToolCallResultMark,
} from "./replay.ts";
export {
  parseClaudeTranscript,
  type ParseClaudeTranscriptOptions,
  type ClaudeTranscriptParseResult,
} from "./adapters/claude-transcript.ts";

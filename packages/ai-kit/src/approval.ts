// The operator-facing approval seam (ADR-0360 U-2/U-3, S3): `approveToolCall`/`denyToolCall` are
// the ONLY writers of `tool.approved`/`tool.denied` — they transition the durable run-state CAS
// (`RunStateStore`), then append the actor-carrying decision event to the trajectory log, then (for
// approve) enqueue the resume job. Both are idempotent under a retry: `RunStateStore.approve`/`deny`
// report `wasNoop` for a repeat call, and the trajectory append/job enqueue happen ONLY on the call
// that actually performed the transition — a retry never double-appends (which would hit the
// append-only store as a REWRITE conflict, since a fresh `eventId`/`occurredAt` is never
// byte-identical to the first attempt) and never double-charges a resume execution (the resume
// path's OWN `claimResume` CAS is the final guard even if this enqueue somehow ran twice).
//
// Transport (PLAN-gate decision, SPEC §4 / PLAN task 5): a direct service/DB call, never an MCP
// round-trip — `caisson run approve|deny` is operator-side tooling against the buyer's own
// deployment. This module is the service the CLI verbs call into (directly, in-process) OR that a
// hosted admin surface calls into — never itself a network transport.
import { randomUUID } from "node:crypto";
import type { JobQueue } from "@caisson/jobs";
import {
  TRAJECTORY_VERSION,
  type RunStateStore,
  type RunStatus,
  type TrajectoryEvent,
  type TrajectoryStore,
} from "@caisson/agent-trajectory";
import { ValidationError } from "@caisson/kernel";

/** The pg-boss/JobQueue task name `approveToolCall` enqueues (ADR-0360 U-3): the enqueue itself IS
 *  the wake signal — no job exists for a run while it is parked. */
export const RESUME_TASK_NAME = "agent-run.resume";

export interface ApprovalDeps {
  /** Already tenant-scoped (constructed inside the caller's own `withTenant`) — mirrors
   *  `createPgTrajectoryStore`/`createPgRunStateStore`'s "fresh instance per transaction" lifecycle,
   *  so the run-state CAS and the trajectory append commit together. */
  readonly store: TrajectoryStore;
  readonly runState: RunStateStore;
  /** The resume job is enqueued through this port — never called inline (mirrors every other
   *  billing/side-effect enqueue in this codebase, `@caisson/jobs`'s own doc). */
  readonly jobs: JobQueue;
}

export interface ApprovalOutcome {
  readonly runId: string;
  readonly toolCallId: string;
  readonly status: RunStatus;
}

function assertActor(actor: string): void {
  if (actor.trim().length === 0) {
    throw new ValidationError(
      "an approve/deny decision requires a non-empty actor",
    );
  }
}

function appendedEvent(
  runId: string,
  seq: number,
  kind: TrajectoryEvent["kind"],
  payload: unknown,
): TrajectoryEvent {
  return {
    eventId: randomUUID(),
    runId,
    seq,
    version: TRAJECTORY_VERSION,
    occurredAt: new Date().toISOString(),
    kind,
    payload,
  } as TrajectoryEvent;
}

/**
 * Approve a parked tool call (ADR-0360 U-2). CAS `parked -> running` in `RunStateStore` (reserving
 * exactly one trajectory seq slot for the `tool.approved` event this call is about to append —
 * `resumeSeqAdvance: 1` — so a later `claimResume` hands back the seq AFTER it, never colliding
 * with it), appends the actor-carrying `tool.approved` event, then enqueues the
 * `singletonKey=runId` resume job — the enqueue IS the wake signal (no job exists while parked).
 * Fail-closed: unknown `runId`/`toolCallId` or a status mismatch throws before anything is
 * written. Idempotent under a retry (`wasNoop`): the trajectory append and the job enqueue both
 * run only on the call that performed the transition — a duplicate call just re-confirms success.
 */
export async function approveToolCall(
  deps: ApprovalDeps,
  runId: string,
  toolCallId: string,
  actor: string,
): Promise<ApprovalOutcome> {
  assertActor(actor);
  const result = await deps.runState.approve(runId, toolCallId, 1);
  if (!result.wasNoop) {
    await deps.store.append(
      appendedEvent(runId, result.resumeSeq - 1, "tool.approved", {
        toolCallId,
        actor,
      }),
    );
  }
  // Idempotent under double-approval by construction: pg-boss's native `singletonKey` suppresses a
  // second enqueue while one is queued/active, and the resume path's own `claimResume` CAS is the
  // final guard even in the (should-be-impossible) case this runs twice.
  await deps.jobs.enqueue(RESUME_TASK_NAME, { runId }, { singletonKey: runId });
  return { runId, toolCallId, status: result.status };
}

/**
 * Deny a parked tool call (ADR-0360 U-2). CAS `parked -> finished`, appends the actor-carrying
 * `tool.denied` event followed by a `run.finished` (`status: "failed"`) — mirroring the loop's own
 * terminal bookkeeping for any other failure — and enqueues NOTHING (a denied run never resumes).
 * Same fail-closed + idempotent-on-retry shape as {@link approveToolCall}.
 */
export async function denyToolCall(
  deps: ApprovalDeps,
  runId: string,
  toolCallId: string,
  actor: string,
  reason?: string,
): Promise<ApprovalOutcome> {
  assertActor(actor);
  const result = await deps.runState.deny(runId, toolCallId);
  if (!result.wasNoop) {
    await deps.store.append(
      appendedEvent(runId, result.resumeSeq, "tool.denied", {
        toolCallId,
        actor,
        ...(reason !== undefined ? { reason } : {}),
      }),
    );
    await deps.store.append(
      appendedEvent(runId, result.resumeSeq + 1, "run.finished", {
        status: "failed",
        reason: "tool-denied",
      }),
    );
  }
  return { runId, toolCallId, status: result.status };
}

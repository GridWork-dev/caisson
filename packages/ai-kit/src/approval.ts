// The operator-facing approval seam (ADR-0360 U-2/U-3, S3): `approveToolCall`/`denyToolCall` are
// the ONLY writers of `tool.approved`/`tool.denied` — they transition the durable run-state CAS
// (`RunStateStore`), then append the actor-carrying decision event to the trajectory log, then (for
// approve) enqueue the resume job. Both are idempotent under a retry: `RunStateStore.approve`/`deny`
// report `wasNoop` for a repeat call, so a duplicate call never re-appends its own transition event
// with a fresh `eventId`/`occurredAt` (which the append-only store would otherwise reject as a
// REWRITE conflict) and never double-enqueues a resume the `claimResume` CAS wouldn't allow twice
// anyway.
//
// F2 (security audit): the run-state CAS and the trajectory append are TWO SEPARATE transactions
// (see `RunStateStore`/`TrajectoryStore`'s own per-call `withTenant` — a store held open across a
// long-lived caller cannot share one transaction with an unrelated short op; see store.pg.ts's file
// header). A crash between them would otherwise strand the CAS committed with no audit record: the
// approval "happened" but nobody who did it is recorded. `approveToolCall` closes that window by
// self-healing on the `wasNoop` (idempotent-retry) branch — before assuming a prior call's append
// landed, it reads the log tail and re-appends `tool.approved` if it's missing. This is NOT full
// atomicity (a crash mid-window is still observable as two commits, not one) but it is fully
// RECOVERABLE: the next call — success or retry — always leaves the audit record in place before
// returning, so the approval never silently executes with no actor on file.
//
// Transport (PLAN-gate decision, SPEC §4 / PLAN task 5): a direct service/DB call, never an MCP
// round-trip — `caisson run approve|deny` is operator-side tooling against the buyer's own
// deployment. This module is the service the CLI verbs call into (directly, in-process) OR that a
// hosted admin surface calls into — never itself a network transport. The `caisson run` CLI path
// (`packages/cli/src/run.ts`) is fully atomic instead (its raw SQL runs inside ONE transaction,
// short-lived and not shared with any loop) — this module can't share that shape because `store`/
// `runState` are the long-lived ports the loop also holds, not a one-shot connection.
import { randomUUID } from "node:crypto";
import type { JobQueue } from "@caisson-sh/jobs";
import {
  TRAJECTORY_VERSION,
  type RunStateStore,
  type RunStatus,
  type TrajectoryEvent,
  type TrajectoryStore,
} from "@caisson-sh/agent-trajectory";
import { ValidationError } from "@caisson-sh/kernel";

/** The pg-boss/JobQueue task name `approveToolCall` enqueues (ADR-0360 U-3): the enqueue itself IS
 *  the wake signal — no job exists for a run while it is parked. */
export const RESUME_TASK_NAME = "agent-run.resume";

export interface ApprovalDeps {
  /** The PG-backed factories (`createPgTrajectoryStore`/`createPgRunStateStore`) each open their
   *  OWN short-lived `withTenant` transaction PER CALL — they do NOT share one transaction with
   *  each other or with the caller (see store.pg.ts's file header for why: a store held open
   *  across a long-lived run cannot also hold one pre-opened transaction). The run-state CAS and
   *  the trajectory append here are therefore two separate commits; see the F2 note above for how
   *  that gap is closed (self-heal on retry, not shared-transaction atomicity). */
  readonly store: TrajectoryStore;
  readonly runState: RunStateStore;
  /** The resume job is enqueued through this port — never called inline (mirrors every other
   *  billing/side-effect enqueue in this codebase, `@caisson-sh/jobs`'s own doc). */
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
 * written.
 *
 * F2 self-heal (security audit): on the FIRST (winning) call, the append always runs — nothing
 * could have written it yet. On a `wasNoop` RETRY, a prior call already committed the CAS; if it
 * crashed before its own append landed, that append is otherwise lost forever (the CAS is already
 * decided, so no future call would ever try again). This branch checks the log tail for the
 * `tool.approved` event and re-appends it if missing, so the audit record always exists by the
 * time ANY caller of `approveToolCall` sees success.
 */
export async function approveToolCall(
  deps: ApprovalDeps,
  runId: string,
  toolCallId: string,
  actor: string,
): Promise<ApprovalOutcome> {
  assertActor(actor);
  const result = await deps.runState.approve(runId, toolCallId, 1);
  const approvedSeq = result.resumeSeq - 1;
  if (!result.wasNoop) {
    await deps.store.append(
      appendedEvent(runId, approvedSeq, "tool.approved", { toolCallId, actor }),
    );
  } else {
    const events = await deps.store.read(runId);
    const recorded = events.some(
      (e) => e.kind === "tool.approved" && e.payload.toolCallId === toolCallId,
    );
    if (!recorded) {
      await deps.store.append(
        appendedEvent(runId, approvedSeq, "tool.approved", {
          toolCallId,
          actor,
        }),
      );
    }
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

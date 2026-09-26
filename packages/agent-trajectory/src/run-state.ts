// src/run-state.ts — the `RunStateStore` port (ADR-0360 U-3): the durable, MUTABLE sibling of the
// append-only trajectory log. Tracks parked/awaiting-approval status, the pending toolCallId, the
// resume seq pointer, and an opaque resumable snapshot (`parkedState`) a caller (the ai-kit loop)
// needs to continue a parked run after a process restart.
//
// Deliberately NOT part of the append-only trajectory contract: AR-4's digest-only payload
// discipline binds the TRAJECTORY EVENT LOG specifically (schema.ts — the substrate meant to be
// safely persisted/replayed/anchored without leaking bodies). This table is operational run state,
// never replayed or scored by `project()`, so it may carry the caller's real (opaque-to-this-port)
// resumable payload. `parkedState` stays `unknown` here — agent-trajectory is engine-neutral and
// never imports `ai`/`@ai-sdk/*`; the caller (ai-kit) owns its shape and validates it on read.
//
// Every transition is a SQL compare-and-swap (see the PG impl) — never a read-modify-write:
//   park          first park (no row) or a re-park after a claimed resume (status='running', no
//                 unclaimed pending call)
//   approve/deny  parked -> running|finished, keyed on (runId, toolCallId); idempotent on a repeat
//                 of the SAME decision, fail-closed on any other mismatch
//   claimResume   the execution-claim: clears the pending marker so a second concurrent resume of
//                 the SAME approval can never also claim it
//   finish        terminal, from any current status
import { ConflictError, NotFoundError } from "@caisson-sh/kernel";

export type RunStatus = "running" | "parked" | "finished";

/** Read-only view (`caisson run status`) — never exposes `parkedState` (the caller's snapshot may
 *  carry sensitive bodies; this port stays a dumb container, not an authorization boundary). */
export interface RunStateSnapshot {
  readonly runId: string;
  readonly status: RunStatus;
  readonly pendingToolCallId: string | null;
  readonly resumeSeq: number;
  readonly updatedAt: string;
}

/** What a caller needs to actually resume execution: the trajectory seq to continue appending
 *  from, and the opaque snapshot it stashed at park time. */
export interface RunResumeMaterial {
  readonly resumeSeq: number;
  readonly parkedState: unknown;
}

/** `approve`/`deny`'s result: the usual snapshot PLUS whether THIS call was the one that performed
 *  the transition (`wasNoop: false`) or found it already decided (`wasNoop: true`, an idempotent
 *  retry) — the caller needs this to know whether it is safe to append the decision's trajectory
 *  event(s) exactly once (a retry must never re-append — a fresh `eventId`/`occurredAt` would hit
 *  the append-only store as a REWRITE conflict, not a silent no-op). */
export interface TransitionResult extends RunStateSnapshot {
  readonly wasNoop: boolean;
}

export interface ParkInput {
  readonly runId: string;
  readonly toolCallId: string;
  readonly resumeSeq: number;
  readonly parkedState: unknown;
}

export interface RunStateStore {
  /**
   * First-time park (no existing row) or a re-park after a completed resume (current status MUST
   * be `"running"` AND the prior approval must already be claimed — never park over an
   * outstanding, un-executed approval). Fail-closed `ConflictError` on any other current state —
   * parking an already-parked or finished run is a caller bug.
   */
  park(input: ParkInput): Promise<void>;
  /**
   * CAS `parked -> running` for `(runId, toolCallId)`. Idempotent: a second approve of the SAME
   * `(runId, toolCallId)` after the first committed is a no-op success (`wasNoop: true`, the same
   * snapshot). A genuine mismatch (unknown runId, wrong toolCallId, already denied, or a status
   * the CAS doesn't admit) throws `NotFoundError`/`ConflictError` — fail-closed.
   *
   * `resumeSeqAdvance` (default 0) is added to the stored `resumeSeq` ATOMICALLY with the
   * transition, ONLY on the call that actually performs it (never on an idempotent retry) — the
   * caller passes the number of trajectory events IT is about to append as part of recording this
   * approval (typically 1, for `tool.approved`), so a later `claimResume` hands back the seq
   * AFTER those events, not the stale park-time value they would otherwise collide with.
   */
  approve(
    runId: string,
    toolCallId: string,
    resumeSeqAdvance?: number,
  ): Promise<TransitionResult>;
  /** CAS `parked -> finished` for `(runId, toolCallId)`. Same idempotency + fail-closed shape as
   *  {@link RunStateStore.approve} (`wasNoop`, no `resumeSeqAdvance` — a denied run never resumes,
   *  so its trailing `tool.denied`/`run.finished` events land at the unchanged park-time seq). */
  deny(runId: string, toolCallId: string): Promise<TransitionResult>;
  /**
   * CAS execution-claim: flips `claimed` for `(runId, toolCallId)` so a second concurrent resume
   * of the SAME approval cannot also claim it. Throws `ConflictError` when there is nothing
   * claimable (already claimed, wrong toolCallId, or the run isn't in a post-approval claimable
   * state) — the caller decides whether that is benign (the run already finished elsewhere) by
   * re-reading via {@link RunStateStore.read}.
   */
  claimResume(runId: string, toolCallId: string): Promise<RunResumeMaterial>;
  /** Terminal transition from any current status. Unknown runId throws `NotFoundError`. */
  finish(runId: string): Promise<void>;
  /** Read-only snapshot. `undefined` = the run never parked (no row was ever written). */
  read(runId: string): Promise<RunStateSnapshot | undefined>;
}

interface MemoryRow {
  status: RunStatus;
  pendingToolCallId: string | null;
  decision: "approved" | "denied" | null;
  claimed: boolean;
  resumeSeq: number;
  parkedState: unknown;
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toSnapshot(runId: string, r: MemoryRow): RunStateSnapshot {
  return {
    runId,
    status: r.status,
    pendingToolCallId: r.pendingToolCallId,
    resumeSeq: r.resumeSeq,
    updatedAt: r.updatedAt,
  };
}

/**
 * In-memory `RunStateStore` — tests + single-process runs. A PG-backed impl (`run-state.pg.ts`)
 * carries the same CAS semantics over `agent_run_state` with tenant RLS (S3).
 */
export function createMemoryRunStateStore(): RunStateStore {
  const rows = new Map<string, MemoryRow>();

  return {
    async park(input: ParkInput): Promise<void> {
      const existing = rows.get(input.runId);
      if (existing === undefined) {
        rows.set(input.runId, {
          status: "parked",
          pendingToolCallId: input.toolCallId,
          decision: null,
          claimed: false,
          resumeSeq: input.resumeSeq,
          parkedState: input.parkedState,
          updatedAt: nowIso(),
        });
        return;
      }
      if (existing.status !== "running" || !existing.claimed) {
        throw new ConflictError(
          "cannot park: run is not in a claimable running state",
          { runId: input.runId, status: existing.status },
        );
      }
      existing.status = "parked";
      existing.pendingToolCallId = input.toolCallId;
      existing.decision = null;
      existing.claimed = false;
      existing.resumeSeq = input.resumeSeq;
      existing.parkedState = input.parkedState;
      existing.updatedAt = nowIso();
    },

    async approve(
      runId: string,
      toolCallId: string,
      resumeSeqAdvance = 0,
    ): Promise<TransitionResult> {
      const r = rows.get(runId);
      if (r === undefined) {
        throw new NotFoundError("unknown run", { runId });
      }
      if (
        r.status === "parked" &&
        r.pendingToolCallId === toolCallId &&
        r.decision === null
      ) {
        r.status = "running";
        r.decision = "approved";
        r.resumeSeq += resumeSeqAdvance;
        r.updatedAt = nowIso();
        return { ...toSnapshot(runId, r), wasNoop: false };
      }
      // Idempotent retry: this exact toolCallId was already approved.
      if (r.pendingToolCallId === toolCallId && r.decision === "approved") {
        return { ...toSnapshot(runId, r), wasNoop: true };
      }
      throw new ConflictError("cannot approve: run/toolCallId state mismatch", {
        runId,
        toolCallId,
        status: r.status,
        pendingToolCallId: r.pendingToolCallId,
        decision: r.decision,
      });
    },

    async deny(runId: string, toolCallId: string): Promise<TransitionResult> {
      const r = rows.get(runId);
      if (r === undefined) {
        throw new NotFoundError("unknown run", { runId });
      }
      if (
        r.status === "parked" &&
        r.pendingToolCallId === toolCallId &&
        r.decision === null
      ) {
        r.status = "finished";
        r.decision = "denied";
        // RETENTION (security audit finding 1): a terminal run keeps no snapshot around.
        r.parkedState = null;
        r.updatedAt = nowIso();
        return { ...toSnapshot(runId, r), wasNoop: false };
      }
      if (r.pendingToolCallId === toolCallId && r.decision === "denied") {
        return { ...toSnapshot(runId, r), wasNoop: true };
      }
      throw new ConflictError("cannot deny: run/toolCallId state mismatch", {
        runId,
        toolCallId,
        status: r.status,
        pendingToolCallId: r.pendingToolCallId,
        decision: r.decision,
      });
    },

    async claimResume(
      runId: string,
      toolCallId: string,
    ): Promise<RunResumeMaterial> {
      const r = rows.get(runId);
      if (r === undefined) {
        throw new NotFoundError("unknown run", { runId });
      }
      if (
        r.pendingToolCallId === toolCallId &&
        r.decision === "approved" &&
        !r.claimed
      ) {
        r.claimed = true;
        r.updatedAt = nowIso();
        return { resumeSeq: r.resumeSeq, parkedState: r.parkedState };
      }
      throw new ConflictError("nothing claimable for this run/toolCallId", {
        runId,
        toolCallId,
        status: r.status,
        pendingToolCallId: r.pendingToolCallId,
        decision: r.decision,
        claimed: r.claimed,
      });
    },

    async finish(runId: string): Promise<void> {
      const r = rows.get(runId);
      if (r === undefined) {
        throw new NotFoundError("unknown run", { runId });
      }
      r.status = "finished";
      // RETENTION (security audit finding 1): same as deny() — no snapshot survives terminal.
      r.parkedState = null;
      r.updatedAt = nowIso();
    },

    async read(runId: string): Promise<RunStateSnapshot | undefined> {
      const r = rows.get(runId);
      return r === undefined ? undefined : toSnapshot(runId, r);
    },
  };
}

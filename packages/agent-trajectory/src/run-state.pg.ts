// src/run-state.pg.ts — PG-backed `RunStateStore` (ADR-0360 U-3) over `agent_run_state`
// (migrations/0002_agent_run_state.sql). Every transition is a single `UPDATE … WHERE … RETURNING`
// compare-and-swap — never a read-then-write — so two concurrent callers racing the SAME transition
// can never both "win": Postgres row-level locking serializes the two UPDATEs, and the loser's WHERE
// clause re-evaluates against the FIRST winner's already-committed row and matches zero rows.
//
// PER-CALL TENANT SCOPING (mirrors `store.pg.ts` — see its file header for the full rationale): a
// `RunStateStore` is held for a run's whole life and its methods interleave with the loop's OWN
// separate ai-meter `withTenant` calls; holding one pre-opened transaction across that span deadlocks
// PGlite (a single connection) on the nested `withTenant`. Every method here opens its OWN
// short-lived `withTenant` transaction instead. `@caisson/tenancy-rls` is a REAL runtime dependency.
import { ConflictError, NotFoundError } from "@caisson/kernel";
import {
  withTenant,
  type TenantExecutor,
  type Transactor,
} from "@caisson/tenancy-rls";
import type {
  ParkInput,
  RunResumeMaterial,
  RunStateSnapshot,
  RunStateStore,
  RunStatus,
  TransitionResult,
} from "./run-state.ts";

interface Row {
  readonly status: RunStatus;
  readonly pending_tool_call_id: string | null;
  readonly decision: "approved" | "denied" | null;
  readonly claimed: boolean;
  readonly resume_seq: number;
  readonly parked_state: unknown;
  readonly updated_at: unknown;
}

function toSnapshot(runId: string, row: Row): RunStateSnapshot {
  const updatedAt = row.updated_at;
  return {
    runId,
    status: row.status,
    pendingToolCallId: row.pending_tool_call_id,
    resumeSeq: row.resume_seq,
    updatedAt:
      updatedAt instanceof Date ? updatedAt.toISOString() : String(updatedAt),
  };
}

async function readRow(
  exec: TenantExecutor,
  runId: string,
): Promise<Row | undefined> {
  const res = await exec.query<Row>(
    `SELECT status, pending_tool_call_id, decision, claimed, resume_seq, parked_state, updated_at
       FROM agent_run_state WHERE run_id = $1`,
    [runId],
  );
  return res.rows[0];
}

/** Build a PG-backed `RunStateStore` bound to one tenant. `tx` is the RAW `Transactor`; every
 *  method call opens its OWN short-lived `withTenant` transaction (see the file header).
 *  `accountId` is stamped on the first-time `park` INSERT and must equal the bound GUC or the RLS
 *  `WITH CHECK` clause rejects it. */
export function createPgRunStateStore(
  tx: Transactor,
  accountId: string,
): RunStateStore {
  return {
    park(input: ParkInput): Promise<void> {
      return withTenant(tx, accountId, async (exec) => {
        // First-time park: no existing row, plain INSERT. Re-park (a later gated tool in the
        // SAME run, after a prior approval was claimed): CAS-guarded UPDATE — only proceeds while
        // the run is "running" with no unclaimed pending call.
        const res = await exec.query(
          `INSERT INTO agent_run_state
             (run_id, account_id, status, pending_tool_call_id, decision, claimed, resume_seq, parked_state, updated_at)
           VALUES ($1, $2, 'parked', $3, NULL, false, $4, $5::jsonb, now())
           ON CONFLICT (run_id) DO UPDATE
             SET status = 'parked',
                 pending_tool_call_id = EXCLUDED.pending_tool_call_id,
                 decision = NULL,
                 claimed = false,
                 resume_seq = EXCLUDED.resume_seq,
                 parked_state = EXCLUDED.parked_state,
                 updated_at = now()
             WHERE agent_run_state.status = 'running'
               AND agent_run_state.claimed = true
           RETURNING run_id`,
          [
            input.runId,
            accountId,
            input.toolCallId,
            input.resumeSeq,
            JSON.stringify(input.parkedState ?? null),
          ],
        );
        if (res.rows.length === 0) {
          throw new ConflictError(
            "cannot park: run is not in a claimable running state",
            { runId: input.runId },
          );
        }
      });
    },

    approve(
      runId: string,
      toolCallId: string,
      resumeSeqAdvance = 0,
    ): Promise<TransitionResult> {
      return withTenant(tx, accountId, async (exec) => {
        const res = await exec.query<Row>(
          `UPDATE agent_run_state
              SET status = 'running', decision = 'approved', resume_seq = resume_seq + $3, updated_at = now()
            WHERE run_id = $1 AND status = 'parked' AND pending_tool_call_id = $2 AND decision IS NULL
            RETURNING status, pending_tool_call_id, decision, claimed, resume_seq, parked_state, updated_at`,
          [runId, toolCallId, resumeSeqAdvance],
        );
        const won = res.rows[0];
        if (won !== undefined)
          return { ...toSnapshot(runId, won), wasNoop: false };

        const current = await readRow(exec, runId);
        if (current === undefined) {
          throw new NotFoundError("unknown run", { runId });
        }
        // Idempotent retry: this exact toolCallId was already approved.
        if (
          current.pending_tool_call_id === toolCallId &&
          current.decision === "approved"
        ) {
          return { ...toSnapshot(runId, current), wasNoop: true };
        }
        throw new ConflictError(
          "cannot approve: run/toolCallId state mismatch",
          {
            runId,
            toolCallId,
            status: current.status,
            pendingToolCallId: current.pending_tool_call_id,
            decision: current.decision,
          },
        );
      });
    },

    deny(runId: string, toolCallId: string): Promise<TransitionResult> {
      return withTenant(tx, accountId, async (exec) => {
        const res = await exec.query<Row>(
          `UPDATE agent_run_state
              SET status = 'finished', decision = 'denied', updated_at = now()
            WHERE run_id = $1 AND status = 'parked' AND pending_tool_call_id = $2 AND decision IS NULL
            RETURNING status, pending_tool_call_id, decision, claimed, resume_seq, parked_state, updated_at`,
          [runId, toolCallId],
        );
        const won = res.rows[0];
        if (won !== undefined)
          return { ...toSnapshot(runId, won), wasNoop: false };

        const current = await readRow(exec, runId);
        if (current === undefined) {
          throw new NotFoundError("unknown run", { runId });
        }
        if (
          current.pending_tool_call_id === toolCallId &&
          current.decision === "denied"
        ) {
          return { ...toSnapshot(runId, current), wasNoop: true };
        }
        throw new ConflictError("cannot deny: run/toolCallId state mismatch", {
          runId,
          toolCallId,
          status: current.status,
          pendingToolCallId: current.pending_tool_call_id,
          decision: current.decision,
        });
      });
    },

    claimResume(runId: string, toolCallId: string): Promise<RunResumeMaterial> {
      return withTenant(tx, accountId, async (exec) => {
        const res = await exec.query<Row>(
          `UPDATE agent_run_state
              SET claimed = true, updated_at = now()
            WHERE run_id = $1 AND pending_tool_call_id = $2 AND decision = 'approved' AND claimed = false
            RETURNING status, pending_tool_call_id, decision, claimed, resume_seq, parked_state, updated_at`,
          [runId, toolCallId],
        );
        const won = res.rows[0];
        if (won !== undefined) {
          return { resumeSeq: won.resume_seq, parkedState: won.parked_state };
        }

        const current = await readRow(exec, runId);
        if (current === undefined) {
          throw new NotFoundError("unknown run", { runId });
        }
        throw new ConflictError("nothing claimable for this run/toolCallId", {
          runId,
          toolCallId,
          status: current.status,
          pendingToolCallId: current.pending_tool_call_id,
          decision: current.decision,
          claimed: current.claimed,
        });
      });
    },

    finish(runId: string): Promise<void> {
      return withTenant(tx, accountId, async (exec) => {
        const res = await exec.query(
          `UPDATE agent_run_state SET status = 'finished', updated_at = now() WHERE run_id = $1
           RETURNING run_id`,
          [runId],
        );
        if (res.rows.length === 0) {
          throw new NotFoundError("unknown run", { runId });
        }
      });
    },

    read(runId: string): Promise<RunStateSnapshot | undefined> {
      return withTenant(tx, accountId, async (exec) => {
        const row = await readRow(exec, runId);
        return row === undefined ? undefined : toSnapshot(runId, row);
      });
    },
  };
}

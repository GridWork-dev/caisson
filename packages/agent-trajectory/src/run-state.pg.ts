// src/run-state.pg.ts — PG-backed `RunStateStore` (ADR-0360 U-3) over `agent_run_state`
// (migrations/0002_agent_run_state.sql + 0003's encrypted-column widen). Every transition is a
// single `UPDATE … WHERE … RETURNING` compare-and-swap — never a read-then-write — so two
// concurrent callers racing the SAME transition can never both "win": Postgres row-level locking
// serializes the two UPDATEs, and the loser's WHERE clause re-evaluates against the FIRST winner's
// already-committed row and matches zero rows.
//
// ENCRYPTED-AT-REST parked_state (ADR-0361, S5 gate): `park()` seals the caller's opaque snapshot
// through `@caisson-sh/field-crypto`'s row-bound `encryptField`/`decryptField` (the explicit sibling of
// the transparent Drizzle column — encrypt-field.ts) BEFORE it reaches the row; `claimResume()`
// opens it back. `columnContext` binds the ciphertext to this column; `rowId` is `run_id` — the
// table's stable PRIMARY KEY, immutable across a re-park of the SAME run (encrypt-field.ts's stable-PK
// requirement) — so a ciphertext relocated to another run's row fails AEAD auth on decrypt. This
// mirrors `@caisson-sh/ai-kit`'s `byok-store.ts`: the caller supplies a ready `FieldCryptoContext`
// (built via `derivedContext(provider, accountId)`), never a bare key-provider — no new key-material
// shape (ADR-0361's mandate). `null`/`undefined` parkedState stores SQL NULL, never an envelope of
// "null" — `deny()`/`finish()`'s retention null-out (S3, security audit finding 1) is unaffected and
// unchanged: those paths just write NULL, no crypto involved either way.
//
// PER-CALL TENANT SCOPING (mirrors `store.pg.ts` — see its file header for the full rationale): a
// `RunStateStore` is held for a run's whole life, so non-crypto methods open their OWN short-lived
// `withTenant` transaction. Crypto methods instead receive BOTH the scoped executor and disposable
// context from one runner: wrapped-key persistence and parked_state then commit atomically, without
// a nested `withTenant` deadlock on PGlite's single connection. `@caisson-sh/tenancy-rls` is a REAL
// runtime dependency.
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@caisson-sh/kernel";
import {
  withTenant,
  type TenantExecutor,
  type Transactor,
} from "@caisson-sh/tenancy-rls";
import {
  decryptField,
  encryptField,
  type FieldCryptoContext,
} from "@caisson-sh/field-crypto";
import type {
  ParkInput,
  RunResumeMaterial,
  RunStateSnapshot,
  RunStateStore,
  RunStatus,
  TransitionResult,
} from "./run-state.ts";

/** The stable column identity bound into the crypto AAD (an envelope cannot be moved + opened
 *  elsewhere) — mirrors `@caisson-sh/ai-kit`'s `BYOK_COLUMN_CONTEXT` naming convention. */
const PARKED_STATE_COLUMN_CONTEXT = "agent-runtime.parked_state";

/** Seal a caller's opaque `parkedState` into the base64 field-crypto envelope this column stores,
 *  or `null` through unchanged (deny/finish/an unset park both mean "nothing to encrypt"). */
function sealParkedState(
  ctx: FieldCryptoContext,
  runId: string,
  parkedState: unknown,
): string | null {
  if (parkedState === null || parkedState === undefined) return null;
  return encryptField(
    ctx,
    PARKED_STATE_COLUMN_CONTEXT,
    runId,
    JSON.stringify(parkedState),
  );
}

/** Open a stored envelope back into the caller's opaque snapshot, or `null` through unchanged. A
 *  non-null, non-string value is a schema violation (the column is `text`) — fail closed rather
 *  than pass a non-string to `decryptField`. */
function openParkedState(
  ctx: FieldCryptoContext,
  runId: string,
  stored: unknown,
): unknown {
  if (stored === null || stored === undefined) return null;
  if (typeof stored !== "string") {
    throw new ValidationError(
      "run-state.pg: parked_state envelope must be a string",
      { runId },
    );
  }
  return JSON.parse(
    decryptField(ctx, PARKED_STATE_COLUMN_CONTEXT, runId, stored),
  );
}

interface SnapshotRow {
  readonly status: RunStatus;
  readonly pending_tool_call_id: string | null;
  readonly resume_seq: number;
  readonly updated_at: unknown;
}

interface Row extends SnapshotRow {
  readonly decision: "approved" | "denied" | null;
  readonly claimed: boolean;
  readonly parked_state: string | null;
}

function toSnapshot(runId: string, row: SnapshotRow): RunStateSnapshot {
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

async function readTransitionRow(
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

async function readSnapshotRow(
  exec: TenantExecutor,
  runId: string,
): Promise<SnapshotRow | undefined> {
  const res = await exec.query<SnapshotRow>(
    `SELECT status, pending_tool_call_id, resume_seq, updated_at
       FROM agent_run_state WHERE run_id = $1`,
    [runId],
  );
  return res.rows[0];
}

export interface RunStateCryptoContextRunner {
  <T>(
    fn: (tx: TenantExecutor, ctx: FieldCryptoContext) => Promise<T>,
  ): Promise<T>;
}

type RunStateCryptoContext = FieldCryptoContext | RunStateCryptoContextRunner;

/** Build a PG-backed `RunStateStore` bound to one tenant. `tx` is the RAW `Transactor`; ordinary
 *  methods open a short-lived `withTenant`, while crypto methods use the runner-supplied executor
 *  and context as one atomic scope (see the file header).
 *  `accountId` is stamped on the first-time `park` INSERT and must equal the bound GUC or the RLS
 *  `WITH CHECK` clause rejects it. `crypto` is either a caller-supplied `FieldCryptoContext` or a
 *  lazy runner that acquires one only for `park`/`claimResume`; the runner MUST supply the same
 *  tenant executor used to persist its wrapped keys. Status and terminal bookkeeping never need
 *  plaintext key material. The context tenant MUST equal `accountId`, mirroring
 *  `@caisson-sh/ai-kit`'s `putTenantProviderKey`/`getTenantProviderKey` convention (the RLS scope and
 *  the crypto AAD tenant binding must agree). */
export function createPgRunStateStore(
  tx: Transactor,
  accountId: string,
  crypto: RunStateCryptoContext,
): RunStateStore {
  const withCryptoContext: RunStateCryptoContextRunner =
    typeof crypto === "function"
      ? crypto
      : <T>(
          fn: (exec: TenantExecutor, ctx: FieldCryptoContext) => Promise<T>,
        ): Promise<T> => withTenant(tx, accountId, (exec) => fn(exec, crypto));
  const withValidatedCryptoContext: RunStateCryptoContextRunner = (fn) =>
    withCryptoContext((exec, ctx) => {
      if (ctx.tenantId !== accountId) {
        throw new ValidationError(
          "run-state.pg: crypto context tenant does not match account",
          { accountId, cryptoTenantId: ctx.tenantId },
        );
      }
      return fn(exec, ctx);
    });

  return {
    park(input: ParkInput): Promise<void> {
      return withValidatedCryptoContext(async (exec, cryptoCtx) => {
        // First-time park: no existing row, plain INSERT. Re-park (a later gated tool in the
        // SAME run, after a prior approval was claimed): CAS-guarded UPDATE — only proceeds while
        // the run is "running" with no unclaimed pending call.
        const res = await exec.query(
          `INSERT INTO agent_run_state
             (run_id, account_id, status, pending_tool_call_id, decision, claimed, resume_seq, parked_state, updated_at)
           VALUES ($1, $2, 'parked', $3, NULL, false, $4, $5, now())
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
            sealParkedState(cryptoCtx, input.runId, input.parkedState),
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

        const current = await readTransitionRow(exec, runId);
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
        // parked_state is cleared here (RETENTION, security audit finding 1): once a run is
        // terminal, the plaintext conversation snapshot it held for a resume that will never
        // happen is pure liability, not a resumable asset. `toSnapshot` never surfaces this field
        // anyway (see run-state.ts); this is about what actually sits in the row.
        const res = await exec.query<Row>(
          `UPDATE agent_run_state
              SET status = 'finished', decision = 'denied', parked_state = NULL, updated_at = now()
            WHERE run_id = $1 AND status = 'parked' AND pending_tool_call_id = $2 AND decision IS NULL
            RETURNING status, pending_tool_call_id, decision, claimed, resume_seq, parked_state, updated_at`,
          [runId, toolCallId],
        );
        const won = res.rows[0];
        if (won !== undefined)
          return { ...toSnapshot(runId, won), wasNoop: false };

        const current = await readTransitionRow(exec, runId);
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
      return withValidatedCryptoContext(async (exec, cryptoCtx) => {
        const res = await exec.query<Row>(
          `UPDATE agent_run_state
              SET claimed = true, updated_at = now()
            WHERE run_id = $1 AND pending_tool_call_id = $2 AND decision = 'approved' AND claimed = false
            RETURNING status, pending_tool_call_id, decision, claimed, resume_seq, parked_state, updated_at`,
          [runId, toolCallId],
        );
        const won = res.rows[0];
        if (won !== undefined) {
          return {
            resumeSeq: won.resume_seq,
            parkedState: openParkedState(cryptoCtx, runId, won.parked_state),
          };
        }

        const current = await readTransitionRow(exec, runId);
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
        // RETENTION (security audit finding 1): clear parked_state on every terminal transition,
        // same rationale as deny() above — a completed/failed run's plaintext snapshot has no
        // further use.
        const res = await exec.query(
          `UPDATE agent_run_state SET status = 'finished', parked_state = NULL, updated_at = now() WHERE run_id = $1
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
        const row = await readSnapshotRow(exec, runId);
        return row === undefined ? undefined : toSnapshot(runId, row);
      });
    },
  };
}

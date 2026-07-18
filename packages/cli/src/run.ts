// `caisson run approve|deny|status` (ADR-0360 U-2, S3 PLAN-gate transport decision). Direct
// service/DB call against the buyer's OWN Postgres — never an MCP round-trip: the CLI is
// operator-side tooling against a deployment the operator already has DB credentials for, so an
// MCP hop adds a network auth surface for zero gain.
//
// WHY RAW SQL, NOT @caisson/agent-trajectory (open↔commercial boundary, ADR-0094/0097): `@caisson/
// cli` is OSS-tier (Apache-2.0); `@caisson/agent-trajectory` is commercial. `checkOpenCommercialBoundary`
// (the standards gate) forbids an open package from depending "up" on a commercial one at runtime.
// The CAS/append SQL below is therefore a DELIBERATE, SMALL, hand-kept mirror of agent-trajectory's
// canonical `agent_run_state`/`trajectory_event` shapes (`run-state.pg.ts`/`store.pg.ts`) — same
// table/column names, same CAS semantics, same idempotency rule — covered by its own test suite so
// drift is caught, never silent. `RESUME_TASK_NAME` mirrors `@caisson/ai-kit`'s `approval.ts`
// constant for the same open↔commercial reason.
//
// SECURITY: Zod `.strict()` on the resolved config; `actor` is mandatory on approve/deny; an
// unknown runId/toolCallId or a status mismatch fails closed (the CAS `UPDATE … WHERE …` finds zero
// rows, surfaced as a clear "nothing to approve/deny" error, never a silent no-op success).
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { z } from "zod";
import { ConfigError, ValidationError, parseStrict } from "@caisson/kernel";
import { withTenant, type TenantExecutor } from "@caisson/tenancy-rls";
import { createPgBossJobQueue, type PgBossJobQueueConfig } from "@caisson/jobs";

/** Mirrors `@caisson/agent-trajectory`'s `TRAJECTORY_VERSION` (schema.ts) — see the file header. */
const TRAJECTORY_VERSION = 1;
/** Mirrors `@caisson/ai-kit`'s `approval.ts` `RESUME_TASK_NAME` — see the file header. */
const RESUME_TASK_NAME = "agent-run.resume";

type RunStatus = "running" | "parked" | "finished";

interface RunStateRow {
  readonly status: RunStatus;
  readonly pending_tool_call_id: string | null;
  readonly decision: "approved" | "denied" | null;
  readonly resume_seq: number;
  readonly updated_at: unknown;
}

export interface RunStatusView {
  readonly runId: string;
  readonly status: RunStatus;
  readonly pendingToolCallId: string | null;
  readonly resumeSeq: number;
  readonly updatedAt: string;
}

function toStatusView(runId: string, row: RunStateRow): RunStatusView {
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

async function readRunState(
  exec: TenantExecutor,
  runId: string,
): Promise<RunStateRow | undefined> {
  const res = await exec.query<RunStateRow>(
    `SELECT status, pending_tool_call_id, decision, resume_seq, updated_at
       FROM agent_run_state WHERE run_id = $1`,
    [runId],
  );
  return res.rows[0];
}

/** Exported for the cross-package shape-assertion test only (run.test.ts): validates the exact
 *  objects this file inserts actually parse against @caisson/agent-trajectory's REAL Zod
 *  TrajectoryEvent schema (a devDependency there, never a runtime one — see the file header). */
export function appendedEvent(
  runId: string,
  seq: number,
  kind: string,
  payload: unknown,
): {
  eventId: string;
  runId: string;
  seq: number;
  version: number;
  occurredAt: string;
  kind: string;
  payload: unknown;
} {
  return {
    eventId: randomUUID(),
    runId,
    seq,
    version: TRAJECTORY_VERSION,
    occurredAt: new Date().toISOString(),
    kind,
    payload,
  };
}

async function appendTrajectoryEvent(
  exec: TenantExecutor,
  accountId: string,
  event: ReturnType<typeof appendedEvent>,
): Promise<void> {
  await exec.query(
    `INSERT INTO trajectory_event (id, account_id, run_id, seq, event)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [event.eventId, accountId, event.runId, event.seq, JSON.stringify(event)],
  );
}

export interface RunServiceDeps {
  readonly tx: {
    transaction<T>(fn: (tx: TenantExecutor) => Promise<T>): Promise<T>;
  };
  readonly accountId: string;
  readonly jobs: {
    enqueue(
      name: string,
      payload: unknown,
      options?: { singletonKey?: string },
    ): Promise<void>;
  };
}

export interface DecisionOutcome {
  readonly runId: string;
  readonly toolCallId: string;
  readonly status: RunStatus;
}

/** CAS `parked -> running` (mirrors `RunStateStore.approve`'s `resumeSeqAdvance: 1`), appends the
 *  actor-carrying `tool.approved` event exactly once, then enqueues the resume job. Fail-closed:
 *  unknown runId, wrong toolCallId, or a status the CAS doesn't admit throws `ConfigError`. */
export async function approveRun(
  deps: RunServiceDeps,
  runId: string,
  toolCallId: string,
  actor: string,
): Promise<DecisionOutcome> {
  if (actor.trim().length === 0) {
    throw new ValidationError("approve requires a non-empty --actor");
  }
  const outcome = await withTenant(deps.tx, deps.accountId, async (exec) => {
    const res = await exec.query<RunStateRow>(
      `UPDATE agent_run_state
          SET status = 'running', decision = 'approved', resume_seq = resume_seq + 1, updated_at = now()
        WHERE run_id = $1 AND status = 'parked' AND pending_tool_call_id = $2 AND decision IS NULL
        RETURNING status, pending_tool_call_id, decision, resume_seq, updated_at`,
      [runId, toolCallId],
    );
    const won = res.rows[0];
    if (won !== undefined) {
      await appendTrajectoryEvent(
        exec,
        deps.accountId,
        appendedEvent(runId, won.resume_seq - 1, "tool.approved", {
          toolCallId,
          actor,
        }),
      );
      return { status: won.status, wasNoop: false };
    }
    const current = await readRunState(exec, runId);
    if (current === undefined) {
      throw new ConfigError(`no such run: ${runId}`);
    }
    if (
      current.pending_tool_call_id === toolCallId &&
      current.decision === "approved"
    ) {
      return { status: current.status, wasNoop: true }; // idempotent retry
    }
    throw new ConfigError(
      `cannot approve ${runId}/${toolCallId}: not currently parked awaiting this call`,
    );
  });
  // Idempotent under double-approval: enqueue is safe to repeat (pg-boss singletonKey suppresses
  // overlap; the resume path's own CAS claim is the final guard).
  await deps.jobs.enqueue(RESUME_TASK_NAME, { runId }, { singletonKey: runId });
  return { runId, toolCallId, status: outcome.status };
}

/** CAS `parked -> finished`, appends `tool.denied` + `run.finished(failed)` exactly once. Same
 *  fail-closed + idempotent shape as {@link approveRun}. Never enqueues (a denied run never
 *  resumes). */
export async function denyRun(
  deps: RunServiceDeps,
  runId: string,
  toolCallId: string,
  actor: string,
  reason?: string,
): Promise<DecisionOutcome> {
  if (actor.trim().length === 0) {
    throw new ValidationError("deny requires a non-empty --actor");
  }
  const outcome = await withTenant(deps.tx, deps.accountId, async (exec) => {
    // parked_state is cleared here too (RETENTION, security audit finding 1) — mirrors
    // run-state.pg.ts's deny()/finish(): a terminal run keeps no plaintext snapshot around.
    const res = await exec.query<RunStateRow>(
      `UPDATE agent_run_state
          SET status = 'finished', decision = 'denied', parked_state = NULL, updated_at = now()
        WHERE run_id = $1 AND status = 'parked' AND pending_tool_call_id = $2 AND decision IS NULL
        RETURNING status, pending_tool_call_id, decision, resume_seq, updated_at`,
      [runId, toolCallId],
    );
    const won = res.rows[0];
    if (won !== undefined) {
      await appendTrajectoryEvent(
        exec,
        deps.accountId,
        appendedEvent(runId, won.resume_seq, "tool.denied", {
          toolCallId,
          actor,
          ...(reason !== undefined ? { reason } : {}),
        }),
      );
      await appendTrajectoryEvent(
        exec,
        deps.accountId,
        appendedEvent(runId, won.resume_seq + 1, "run.finished", {
          status: "failed",
          reason: "tool-denied",
        }),
      );
      return won.status;
    }
    const current = await readRunState(exec, runId);
    if (current === undefined) {
      throw new ConfigError(`no such run: ${runId}`);
    }
    if (
      current.pending_tool_call_id === toolCallId &&
      current.decision === "denied"
    ) {
      return current.status; // idempotent retry
    }
    throw new ConfigError(
      `cannot deny ${runId}/${toolCallId}: not currently parked awaiting this call`,
    );
  });
  return { runId, toolCallId, status: outcome };
}

/** Read-only run-state snapshot — `undefined` if the run never parked. */
export async function readRunStatus(
  deps: RunServiceDeps,
  runId: string,
): Promise<RunStatusView | undefined> {
  return withTenant(deps.tx, deps.accountId, async (exec) => {
    const row = await readRunState(exec, runId);
    return row === undefined ? undefined : toStatusView(runId, row);
  });
}

// --- Bin wiring -----------------------------------------------------------------------------

const EnvConfig = z
  .object({
    databaseUrl: z.string().min(1),
    accountId: z.string().min(1),
  })
  .strict();

function resolveConfig(): z.infer<typeof EnvConfig> {
  return parseStrict(EnvConfig, {
    databaseUrl: process.env.DATABASE_URL ?? "",
    accountId: process.env.CAISSON_ACCOUNT_ID ?? "",
  });
}

/** A `Transactor` over a Pool THIS function owns (so `close()` can cleanly `.end()` it) — the same
 *  shape as tenancy-rls's own `nodePgTransactor`, kept local because that helper isn't exported
 *  standalone (only wrapped inside `createSupabaseTransactor`, which manages its own internal pool
 *  with no way to close it — wrong for a short-lived CLI process that must exit promptly). */
function poolTransactor(pool: Pool): {
  transaction<T>(fn: (tx: TenantExecutor) => Promise<T>): Promise<T>;
} {
  return {
    async transaction<T>(fn: (tx: TenantExecutor) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn({
          query: async (sql, params) => {
            const res = await client.query(sql, params);
            return { rows: res.rows };
          },
          exec: async (sql) => {
            await client.query(sql);
          },
        });
        await client.query("COMMIT");
        return result;
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // Best-effort — the connection may already be unusable; the original error wins.
        }
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

function buildDeps(config: z.infer<typeof EnvConfig>): {
  deps: RunServiceDeps;
  close: () => Promise<void>;
} {
  const pool = new Pool({ connectionString: config.databaseUrl });
  pool.on("error", (err) => {
    process.stderr.write(
      `caisson run: idle pooled connection error (survived): ${err.message}\n`,
    );
  });
  const tx = poolTransactor(pool);
  const jobsConfig: PgBossJobQueueConfig = {
    connectionString: config.databaseUrl,
  };
  const jobs = createPgBossJobQueue(
    [
      {
        name: RESUME_TASK_NAME,
        schema: z.object({ runId: z.string() }).strict(),
        handler: async () => {},
      },
    ],
    jobsConfig,
  );
  return {
    deps: { tx, accountId: config.accountId, jobs },
    close: async () => {
      // WR-01 (security review): approve's enqueue lazily boss.start()s a pg-boss client that
      // leaves maintenance timers + its own pool running until stopped — a successful `caisson
      // run approve` would otherwise never exit. deny/status never call enqueue, so this is a
      // safe no-op on those paths (see createPgBossJobQueue's stop()).
      await jobs.stop();
      await pool.end();
    },
  };
}

export const RUN_HELP = `\
caisson run — approval + status for a parked agent run (ADR-0360 U-2)

Usage:
  caisson run approve <runId> <toolCallId> --actor <name>
  caisson run deny    <runId> <toolCallId> --actor <name> [--reason <text>]
  caisson run status  <runId>

Reads DATABASE_URL and CAISSON_ACCOUNT_ID from the environment — direct DB access against your own
deployment (no MCP round-trip). --actor is required on approve/deny.
`;

function flag(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

export async function runRunCli(argv: readonly string[]): Promise<void> {
  const [sub, ...rest] = argv;
  if (sub === undefined || sub === "--help" || sub === "-h") {
    process.stdout.write(RUN_HELP);
    return;
  }

  const config = resolveConfig();
  const { deps, close } = buildDeps(config);
  try {
    if (sub === "approve") {
      const [runId, toolCallId] = rest;
      const actor = flag(rest, "actor");
      if (
        runId === undefined ||
        toolCallId === undefined ||
        actor === undefined
      ) {
        throw new Error(
          "usage: caisson run approve <runId> <toolCallId> --actor <name>",
        );
      }
      const outcome = await approveRun(deps, runId, toolCallId, actor);
      process.stdout.write(`${JSON.stringify(outcome, null, 2)}\n`);
    } else if (sub === "deny") {
      const [runId, toolCallId] = rest;
      const actor = flag(rest, "actor");
      const reason = flag(rest, "reason");
      if (
        runId === undefined ||
        toolCallId === undefined ||
        actor === undefined
      ) {
        throw new Error(
          "usage: caisson run deny <runId> <toolCallId> --actor <name> [--reason <text>]",
        );
      }
      const outcome = await denyRun(deps, runId, toolCallId, actor, reason);
      process.stdout.write(`${JSON.stringify(outcome, null, 2)}\n`);
    } else if (sub === "status") {
      const [runId] = rest;
      if (runId === undefined) {
        throw new Error("usage: caisson run status <runId>");
      }
      const status = await readRunStatus(deps, runId);
      if (status === undefined) {
        process.stdout.write(
          `caisson run status: ${runId} has never parked (no run-state row)\n`,
        );
      } else {
        process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
      }
    } else {
      throw new Error(`run: unknown subcommand ${JSON.stringify(sub)}`);
    }
  } finally {
    await close();
  }
}

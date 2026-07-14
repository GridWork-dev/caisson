// src/anchoring-scheduler.ts — the boot-time external-anchoring checkpoint scheduler (T6; SPEC
// external-anchoring Cadence + Job ownership; ADR-0332 Fork B/C, ADR-0346 P3 = services/license host).
//
// The SECOND in-repo pg-boss consumer pattern (after credit-expiry-scheduler.ts), and a near-exact
// twin of it. INERT UNTIL ARMED: `ANCHOR_CHECKPOINT_SCHEDULE` (a cron expression) unset means
// `startAnchorCheckpointScheduler` returns immediately and NO pg-boss connection is ever opened —
// the license service boots exactly as today. When armed, a daily parent tick enumerates every
// account with an active audit chain and enqueues that account's checkpoint job; the checkpoint
// handler (defined in COMMERCIAL @caisson/audit-worm, never open @caisson/jobs — CR-16) does the
// concrete anchoring AFTER the append commits, through the durable outbox to the TSA.
//
// Fork B cadence: daily default, configurable, HOURLY FLOOR — `assertHourlyFloor` rejects any cron
// whose minute field is not a single fixed value, so the checkpoint can never fire sub-hourly (a
// public-log target at v1.1 has courtesy limits; even the TSA leg keeps the floor for parity).
//
// Fork C infrastructure: the buyer's TSA target URL + trust config arrive as a fully-wired
// `AnchorCheckpointDeps` (store, outbox, TsaAnchorLog, current-anchor reader, target) INJECTED by
// deploy.ts — never a module constant. This module owns the SCHEDULE; the deployment owns the wiring.
//
// Cross-tenant read: enumerating `audit_chain_entry` across every account is exactly what tenant RLS
// forbids for the buyer `app` role. Rather than widen that policy, this reuses the already-provisioned
// `admin_write` role via `withAdminWrite` (a read through an already-write-capable role adds no blast
// radius — this module only ever SELECTs DISTINCT account_id). DEPLOY must apply
// `buildAdminWritePolicySql("audit_chain_entry")` for that role, the same way credit_wallet already
// carries one. Over-enumeration is free: skip-if-receipted makes idle tenants cost nothing.
//
// Boot-failure posture: the commerce/issuer path outranks the checkpoint sweep. A start failure (bad
// connection string, unreachable Postgres, a malformed or sub-hourly cron) logs one stderr line and
// returns — never throws past `startAnchorCheckpointScheduler` — so a misconfigured scheduler can
// never take the license service down at boot.
import {
  createPgBossJobQueue,
  defineTask,
  type JobAlertingDeps,
  type JobQueue,
} from "@caisson/jobs";
import { strictObject } from "@caisson/kernel";
import { withAdminWrite } from "@caisson/org-controls";
import type { Transactor } from "@caisson/tenancy-rls";
import {
  ANCHOR_CHECKPOINT_TASK,
  defineAnchorCheckpointTask,
  enqueueAnchorCheckpoint,
  type AnchorCheckpointDeps,
} from "@caisson/audit-worm";

/** The daily parent-tick task name — enumerates active-chain accounts, fans out per-account jobs. */
export const ANCHOR_CHECKPOINT_TICK_TASK = "audit-worm.anchor_checkpoint_tick";

/** Empty payload — the tick carries no per-run data, only the cron trigger itself. */
const tickPayloadSchema = strictObject({});

/**
 * Resolve the arming cron expression from env; `null` (inert) unless a non-blank value is set. Same
 * shape as `loadCreditExpiryScheduleConfig` — pg-boss validates the cron SYNTAX at `schedule()` time;
 * this module additionally enforces the Fork B hourly floor (`assertHourlyFloor`) at start.
 */
export function loadAnchorCheckpointScheduleConfig(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const cron = env.ANCHOR_CHECKPOINT_SCHEDULE?.trim() ?? "";
  return cron === "" ? null : cron;
}

/**
 * Enforce the Fork B hourly floor: the 5-field cron's MINUTE (first field) must be a single fixed
 * value 0-59, so the tick fires at most once per hour. `0 3 * * *` (daily) and `0 * * * *` (hourly)
 * pass; a wildcard, a step value, comma-lists, and ranges are all rejected. Throws (caught by the
 * boot try/catch).
 * ponytail: fixed-minute floor only; a full cron-interval parser if a buyer ever needs an odd minute
 * spread that still respects the floor.
 */
export function assertHourlyFloor(cron: string): void {
  const minute = cron.trim().split(/\s+/)[0];
  if (minute === undefined || !/^[0-5]?[0-9]$/.test(minute)) {
    throw new Error(
      "ANCHOR_CHECKPOINT_SCHEDULE must fire at most hourly: the cron minute field must be a single fixed value 0-59 (e.g. '0 3 * * *' daily or '0 * * * *' hourly)",
    );
  }
}

/**
 * Every account with an active audit chain, read cross-tenant via the `admin_write` role (see module
 * doc). Deterministic order so a test asserting the returned list needs no sort.
 */
export async function listActiveChainAccountIds(
  db: Transactor,
): Promise<string[]> {
  return withAdminWrite(db, async (tx) => {
    const r = await tx.query<{ account_id: string }>(
      "SELECT DISTINCT account_id FROM audit_chain_entry ORDER BY account_id",
    );
    return r.rows.map((row) => row.account_id);
  });
}

/** One tick: enumerate active-chain accounts, enqueue each account's checkpoint job. */
export async function runAnchorCheckpointTick(
  db: Transactor,
  queue: JobQueue,
): Promise<void> {
  const accountIds = await listActiveChainAccountIds(db);
  for (const accountId of accountIds) {
    await enqueueAnchorCheckpoint(queue, { accountId });
  }
}

export interface AnchorCheckpointSchedulerDeps {
  /** The tenant Transactor — the same one the issuer/webhook already use. */
  db: Transactor;
  /** Raw Postgres connection string; pg-boss manages its own pool from it, separate from `db`. */
  connectionString: string;
  /** `loadAnchorCheckpointScheduleConfig`'s result — `null`/blank means inert. */
  schedule: string | null | undefined;
  /**
   * The fully-wired checkpoint handler deps (Fork C): the WORM store, the durable `AnchorOutbox`, the
   * `TsaAnchorLog` built from the buyer's TSA URL, the current-anchor reader adapter, and the TSA
   * target. deploy.ts constructs these at boot; this module only registers + schedules them.
   */
  checkpoint: AnchorCheckpointDeps;
  /** Job-failure alerting — absent = no alert, same posture as the credit-expiry scheduler. */
  alerting?: JobAlertingDeps;
  /** Injectable `createPgBossJobQueue` seam — tests assert this is NEVER called when inert. */
  createQueue?: typeof createPgBossJobQueue;
  /** Logger seam — defaults to this service's stderr convention (no console.log in product code). */
  log?: (message: string) => void;
}

/**
 * Start the scheduler if armed. Returns immediately, constructing nothing, when `schedule` is
 * unset/blank. A start failure (including a sub-hourly cron) logs and returns rather than throwing.
 */
export async function startAnchorCheckpointScheduler(
  deps: AnchorCheckpointSchedulerDeps,
): Promise<void> {
  const cron = deps.schedule?.trim();
  if (cron === undefined || cron === "") return;

  const log =
    deps.log ??
    ((message: string) => {
      process.stderr.write(`${message}\n`);
    });
  const createQueue = deps.createQueue ?? createPgBossJobQueue;

  try {
    // Fork B floor: reject a sub-hourly cron BEFORE opening any pg-boss connection (throws → caught).
    assertHourlyFloor(cron);

    // A boxed ref, not a reassigned `let`: the tick handler closes over `queueBox` and reads `.queue`
    // only once pg-boss actually claims a job — strictly after the synchronous assignment below.
    const queueBox: { queue?: JobQueue } = {};
    const tickTask = defineTask(
      ANCHOR_CHECKPOINT_TICK_TASK,
      tickPayloadSchema,
      async () => {
        await runAnchorCheckpointTick(deps.db, queueBox.queue as JobQueue);
      },
    );
    const checkpointTask = defineAnchorCheckpointTask(deps.checkpoint);

    const started = createQueue([checkpointTask, tickTask], {
      connectionString: deps.connectionString,
      ...(deps.alerting !== undefined ? { alerting: deps.alerting } : {}),
    });
    queueBox.queue = started;
    await started.work(ANCHOR_CHECKPOINT_TASK);
    await started.work(ANCHOR_CHECKPOINT_TICK_TASK);
    await started.schedule(ANCHOR_CHECKPOINT_TICK_TASK, cron, {});
  } catch (err) {
    log(
      `[service-license] anchor-checkpoint scheduler failed to start: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

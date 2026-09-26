// The boot-time scheduler for the credit-expiry sweep + T-30d notice tasks (ADR-0256, extends
// ADR-0252): the FIRST in-repo pg-boss consumer. INERT UNTIL ARMED — `CREDIT_EXPIRY_SCHEDULE` (a
// cron expression) unset means `startCreditExpiryScheduler` returns immediately and no pg-boss
// connection is ever opened; the service boots exactly as today. When armed, a daily parent tick
// enumerates every account holding a credit wallet and enqueues that account's sweep + notice job;
// the tasks' own `singletonKey` dedup (the account id) is the double-enqueue guard, not this module.
//
// G24 (buyer-lifecycle audit 2026-07-07) extends this SAME scheduler with a second parent tick
// (`UPDATES_WINDOW_EXPIRY_TICK_TASK`) over a DIFFERENT account population — accounts holding a
// windowed one_time entitlement grant — reusing the same arming/boot posture, pg-boss connection,
// and emailer instance rather than a second env-gated cron.
//
// Cross-tenant read: enumerating `credit_wallet` across every account is exactly what tenant RLS
// forbids for the buyer `app` role. Rather than widen that policy (or add a new role), this reuses
// the ALREADY-provisioned `admin_write` role (`ADMIN_MUTATION_PROVISION_SQL` in admin-mutations.ts
// already grants it a full-command policy on `credit_wallet` for the negative-adjust admin
// mutation) via the same `withAdminWrite` seam — a read through an already-write-capable role adds
// no new blast radius here, since this module only ever SELECTs.
//
// Boot failure posture: the commerce path (webhook/issuer) outranks the sweep. A scheduler start
// failure (bad connection string, unreachable Postgres, a malformed cron) logs one stderr line and
// returns — never throws past `startCreditExpiryScheduler` — so a misconfigured scheduler can never
// take the license service down at boot. Once running, per-job failures are pg-boss's own retry
// territory (never caught inside a task handler).
import {
  createPgBossJobQueue,
  defineTask,
  type JobAlertingDeps,
  type JobQueue,
} from "@caisson/jobs";
import { strictObject } from "@caisson/kernel";
// The admin-write role helpers moved to the commercial @caisson/org-controls carve (ADR-0257 §1.3);
// only the Transactor type stays in the open @caisson/tenancy-rls base.
import { withAdminWrite } from "@caisson/org-controls";
import type { Transactor } from "@caisson/tenancy-rls";
import {
  CREDIT_EXPIRY_NOTICE_TASK,
  CREDIT_EXPIRY_SWEEP_TASK,
  defineCreditExpiryNoticeTask,
  defineCreditExpirySweepTask,
  enqueueCreditExpiryNotice,
  enqueueCreditExpirySweep,
  type ExpiryNoticeEmailer,
} from "@caisson/credits";
import {
  defineUpdatesWindowExpiryNoticeTask,
  enqueueUpdatesWindowExpiryNotice,
  UPDATES_WINDOW_EXPIRY_NOTICE_TASK,
} from "./updates-window-expiry-task.ts";

/** The daily parent-tick task name — enumerates wallet accounts, fans out per-account jobs. */
export const CREDIT_EXPIRY_TICK_TASK = "credits.expiry_tick";

/** Empty payload — the tick carries no per-run data, only the cron trigger itself. */
const tickPayloadSchema = strictObject({});

/**
 * Resolve the arming cron expression from env; `null` (inert) unless a non-blank value is set. Same
 * shape as `loadDiscordNotifyConfig`/`loadPostHogCaptureConfig` (discord-notify.ts,
 * posthog-capture.ts) — a bare optional string needs no Zod schema; pg-boss validates the cron
 * syntax itself at `schedule()` time, caught by `startCreditExpiryScheduler`'s try/catch below
 * rather than crashing boot.
 */
export function loadCreditExpiryScheduleConfig(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const cron = env.CREDIT_EXPIRY_SCHEDULE?.trim() ?? "";
  return cron === "" ? null : cron;
}

/**
 * Every account with a credit wallet, read cross-tenant via the `admin_write` role (see module doc
 * for why this reuses that role instead of widening the tenant policy). Deterministic order so a
 * test asserting the returned list needs no sort.
 */
export async function listWalletAccountIds(db: Transactor): Promise<string[]> {
  return withAdminWrite(db, async (tx) => {
    const r = await tx.query<{ account_id: string }>(
      "SELECT DISTINCT account_id FROM credit_wallet ORDER BY account_id",
    );
    return r.rows.map((row) => row.account_id);
  });
}

/** One daily tick: enumerate wallet accounts, enqueue each account's sweep + notice job. */
export async function runCreditExpiryTick(
  db: Transactor,
  queue: JobQueue,
): Promise<void> {
  const accountIds = await listWalletAccountIds(db);
  for (const accountId of accountIds) {
    await enqueueCreditExpirySweep(queue, { accountId });
    await enqueueCreditExpiryNotice(queue, { accountId });
  }
}

/** The G24 parent-tick task name — enumerates accounts holding an active windowed one_time
 *  entitlement grant, fans out per-account notice jobs. A SEPARATE tick from
 *  {@link CREDIT_EXPIRY_TICK_TASK} (a different account population — `entitlement_grant`, not
 *  `credit_wallet`) but scheduled on the SAME cron, reusing this one scheduler's arming/boot
 *  posture rather than a second env-gated cron. */
export const UPDATES_WINDOW_EXPIRY_TICK_TASK =
  "entitlement.updates_window_expiry_tick";

/**
 * Every account holding an ACTIVE one_time entitlement grant with a windowed expiry, read
 * cross-tenant via the SAME already-provisioned `admin_write` role (`ADMIN_MUTATION_PROVISION_SQL`
 * already grants it a full-command policy on `entitlement_grant` for the admin comp-grant
 * mutations) — the same reuse rationale as {@link listWalletAccountIds}.
 */
export async function listUpdatesWindowAccountIds(
  db: Transactor,
): Promise<string[]> {
  return withAdminWrite(db, async (tx) => {
    const r = await tx.query<{ account_id: string }>(
      `SELECT DISTINCT account_id FROM entitlement_grant
         WHERE source_kind = 'one_time' AND status = 'active' AND updates_expires_at IS NOT NULL
         ORDER BY account_id`,
    );
    return r.rows.map((row) => row.account_id);
  });
}

/** One daily tick (G24): enumerate windowed accounts, enqueue each account's expiry-notice job. */
export async function runUpdatesWindowExpiryTick(
  db: Transactor,
  queue: JobQueue,
): Promise<void> {
  const accountIds = await listUpdatesWindowAccountIds(db);
  for (const accountId of accountIds) {
    await enqueueUpdatesWindowExpiryNotice(queue, { accountId });
  }
}

export interface CreditExpirySchedulerDeps {
  /** The tenant Transactor — the same one the issuer/webhook already use. */
  db: Transactor;
  /** Raw Postgres connection string; pg-boss manages its own pool from it, separate from `db`. */
  connectionString: string;
  /** `loadCreditExpiryScheduleConfig`'s result — `null`/blank means inert. */
  schedule: string | null | undefined;
  /**
   * Driver-gated emailer (ADR-0252 posture): `null` when no email driver is configured. `deploy.ts`
   * wires the real `email-notify.ts#resolveEmailer()` transport (Resend or capture, never null); a
   * caller may still pass `null` explicitly (e.g. a test) to prove the notice task then records
   * nothing sent while the sweep still burns residue.
   */
  emailer: ExpiryNoticeEmailer | null;
  /** Resolve an account's notification address (`email-notify.ts#recipientFor`); unreachable while
   *  `emailer` is `null`. */
  recipientFor: (accountId: string) => Promise<string | null>;
  /** The credit-expiry notice email's CTA link — the buyer credits dashboard. */
  dashboardUrl: string;
  /**
   * G24 — the updates-window expiry notice's OWN CTA link (the buyer license page, not the
   * credits page — a different notice about a different axis). Defaults to `dashboardUrl` when
   * omitted so every existing caller/test keeps compiling; `deploy.ts` passes the real
   * `/dashboard/license` URL explicitly.
   */
  updatesWindowDashboardUrl?: string;
  /** Job-failure alerting — absent = no alert, the same posture
   *  `createPgBossJobQueue`'s own `alerting` field defaults to. `deploy.ts` wires
   *  `createJobAlertingDeps(loadOpsAlertChannels())` (alerting.ts). */
  alerting?: JobAlertingDeps;
  /** Injectable `createPgBossJobQueue` seam — tests assert this is NEVER called when inert. */
  createQueue?: typeof createPgBossJobQueue;
  /** Logger seam — defaults to this service's stderr convention (no console.log in product code). */
  log?: (message: string) => void;
}

/**
 * Start the scheduler if armed. Returns immediately, constructing nothing, when `schedule` is
 * unset/blank. A start failure logs and returns rather than throwing — see module doc.
 */
export async function startCreditExpiryScheduler(
  deps: CreditExpirySchedulerDeps,
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
    // A boxed ref, not a reassigned `let`: the tick handler closes over `queueBox` (defined below,
    // before `createQueue` exists) and reads `.queue` only once pg-boss actually claims a job —
    // strictly after the synchronous assignment right after construction, a few lines down.
    const queueBox: { queue?: JobQueue } = {};
    const tickTask = defineTask(
      CREDIT_EXPIRY_TICK_TASK,
      tickPayloadSchema,
      async () => {
        await runCreditExpiryTick(deps.db, queueBox.queue as JobQueue);
      },
    );
    const sweepTask = defineCreditExpirySweepTask({ db: deps.db });
    const noticeTask = defineCreditExpiryNoticeTask({
      db: deps.db,
      emailer: deps.emailer,
      recipientFor: deps.recipientFor,
      dashboardUrl: deps.dashboardUrl,
    });
    // G24: a SECOND parent tick (different account population — entitlement_grant, not
    // credit_wallet) sharing this SAME scheduler's arming/boot posture and the SAME emailer
    // instance (structurally compatible — `ExpiryNoticeEmailer`/`UpdatesWindowExpiryEmailer` are
    // the identical minimal `send()` shape).
    const updatesWindowTickTask = defineTask(
      UPDATES_WINDOW_EXPIRY_TICK_TASK,
      tickPayloadSchema,
      async () => {
        await runUpdatesWindowExpiryTick(deps.db, queueBox.queue as JobQueue);
      },
    );
    const updatesWindowNoticeTask = defineUpdatesWindowExpiryNoticeTask({
      db: deps.db,
      emailer: deps.emailer,
      recipientFor: deps.recipientFor,
      dashboardUrl: deps.updatesWindowDashboardUrl ?? deps.dashboardUrl,
    });

    const started = createQueue(
      [
        sweepTask,
        noticeTask,
        tickTask,
        updatesWindowNoticeTask,
        updatesWindowTickTask,
      ],
      {
        connectionString: deps.connectionString,
        ...(deps.alerting !== undefined ? { alerting: deps.alerting } : {}),
      },
    );
    queueBox.queue = started;
    await started.work(CREDIT_EXPIRY_SWEEP_TASK);
    await started.work(CREDIT_EXPIRY_NOTICE_TASK);
    await started.work(CREDIT_EXPIRY_TICK_TASK);
    await started.work(UPDATES_WINDOW_EXPIRY_NOTICE_TASK);
    await started.work(UPDATES_WINDOW_EXPIRY_TICK_TASK);
    await started.schedule(CREDIT_EXPIRY_TICK_TASK, cron, {});
    await started.schedule(UPDATES_WINDOW_EXPIRY_TICK_TASK, cron, {});
  } catch (err) {
    log(
      `[service-license] credit-expiry scheduler failed to start: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

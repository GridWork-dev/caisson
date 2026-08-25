// The abandoned-checkout email scheduler (SPEC outputs/specs/deferred-respec/
// SPEC-abandoned-checkout-email.md, operator-locked 2026-07-10). A single daily cron tick, cloned
// from `credit-expiry-scheduler.ts`'s shape exactly: INERT UNTIL ARMED —
// DEPLOY GATE: arm `ABANDONED_CHECKOUT_SCHEDULE` only AFTER `ADMIN_MUTATION_PROVISION_SQL` has
// been re-run against the license DB — `listAbandonedCheckoutAccountIds` reads
// `checkout_abandonment` as `admin_write`, whose SELECT policy ships in the admin provision
// script, not migration 0024; armed-before-provisioned means every tick throws permission-denied
// and no email ever sends (same dependency credit-expiry-scheduler carries).
// `ABANDONED_CHECKOUT_SCHEDULE` (a cron expression) unset means `startAbandonedCheckoutScheduler`
// returns immediately and no pg-boss connection is ever opened. When armed, a daily parent tick
// enumerates every account holding a checkout_abandonment row old enough to be notice-eligible
// (N=24h, LOCKED — no env override, this is a product decision not a deploy knob) and enqueues one
// per-account notice job; the job's own `singletonKey` (the account id) is the double-enqueue
// guard, not this module.
//
// Cross-tenant read: enumerating checkout_abandonment across every account is exactly what tenant
// RLS forbids for the buyer `app` role — reused via the SAME already-provisioned `admin_write`
// role `listAbandonedCheckoutAccountIds` reads through (see checkout-abandonment-store.ts).
//
// Boot failure posture: same as credit-expiry-scheduler.ts — a start failure logs one stderr line
// and returns, never throws past `startAbandonedCheckoutScheduler`, so a misconfigured scheduler
// can never take the license service down at boot.
import {
  createPgBossJobQueue,
  defineTask,
  type JobAlertingDeps,
  type JobQueue,
} from "@caisson/jobs";
import { strictObject } from "@caisson/kernel";
import type { Emailer } from "@caisson/email";
import type { Transactor } from "@caisson/tenancy-rls";
import { withTenant } from "@caisson/tenancy-rls";
import { z } from "zod";
import {
  listAbandonedCheckoutAccountIds,
  sweepEligibleAbandonedCheckout,
} from "./checkout-abandonment-store.ts";
import { notifyAbandonedCheckout } from "./email-notify.ts";
import {
  capturePostHogAbandonedCheckoutEmailSent,
  type PostHogCaptureConfig,
} from "./posthog-capture.ts";

/** LOCKED send delay (operator, 2026-07-10 — SPEC open fork 1) — not env-configurable; this is a
 *  product decision, not a deploy knob. */
export const ABANDONED_CHECKOUT_DELAY_HOURS = 24;

/** The daily parent-tick task name. */
export const ABANDONED_CHECKOUT_TICK_TASK = "checkout.abandonment_tick";
/** The per-account notice task name. */
export const ABANDONED_CHECKOUT_NOTICE_TASK = "checkout.abandonment_notice";

const tickPayloadSchema = strictObject({});
const noticePayloadSchema = strictObject({ accountId: z.string().min(1) });
type NoticePayload = z.infer<typeof noticePayloadSchema>;

export interface AbandonedCheckoutNoticeTaskDeps {
  db: Transactor;
  emailer: Emailer | null;
  posthog: PostHogCaptureConfig | null;
}

/** The reusable, idempotent per-account handler shared by the legacy scheduler and finite Job. */
export function defineAbandonedCheckoutNoticeTask(
  deps: AbandonedCheckoutNoticeTaskDeps,
) {
  return defineTask(
    ABANDONED_CHECKOUT_NOTICE_TASK,
    noticePayloadSchema,
    async (payload: NoticePayload) => {
      const result = await withTenant(deps.db, payload.accountId, (tx) =>
        sweepEligibleAbandonedCheckout(
          tx,
          payload.accountId,
          ABANDONED_CHECKOUT_DELAY_HOURS,
        ),
      );
      if (result === null) return;

      if (deps.emailer !== null) {
        await notifyAbandonedCheckout(deps.db, deps.emailer, {
          accountId: payload.accountId,
          lines: result.lines,
        });
      }
      if (deps.posthog !== null) {
        await capturePostHogAbandonedCheckoutEmailSent(deps.posthog, {
          accountId: payload.accountId,
          itemCount: result.lines.length,
        });
      }
    },
  );
}

/** Resolve the arming cron expression from env; `null` (inert) unless a non-blank value is set —
 *  same shape as `loadCreditExpiryScheduleConfig`. */
export function loadAbandonedCheckoutScheduleConfig(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const cron = env.ABANDONED_CHECKOUT_SCHEDULE?.trim() ?? "";
  return cron === "" ? null : cron;
}

/** One daily tick: enumerate notice-eligible accounts, enqueue each account's notice job. */
export async function runAbandonedCheckoutTick(
  db: Transactor,
  queue: JobQueue,
): Promise<void> {
  const accountIds = await listAbandonedCheckoutAccountIds(
    db,
    ABANDONED_CHECKOUT_DELAY_HOURS,
  );
  for (const accountId of accountIds) {
    await queue.enqueue(
      ABANDONED_CHECKOUT_NOTICE_TASK,
      { accountId },
      { singletonKey: accountId },
    );
  }
}

export interface AbandonedCheckoutSchedulerDeps {
  db: Transactor;
  connectionString: string;
  /** `loadAbandonedCheckoutScheduleConfig`'s result — `null`/blank means inert. */
  schedule: string | null | undefined;
  /** `null` when email is unconfigured — the notice task still marks the row (so it is never
   *  re-attempted once real email comes online mid-window) but sends nothing. `deploy.ts` wires
   *  the real `email-notify.ts#resolveEmailer()` transport (Resend or capture, never actually
   *  null in prod — mirrors every other notifier's driver-gated posture). */
  emailer: Emailer | null;
  /** `null` when POSTHOG_CAPTURE_KEY is unset — the `abandoned_checkout_email_sent` capture is
   *  simply skipped. */
  posthog: PostHogCaptureConfig | null;
  alerting?: JobAlertingDeps;
  createQueue?: typeof createPgBossJobQueue;
  log?: (message: string) => void;
}

/**
 * Start the scheduler if armed. Returns immediately, constructing nothing, when `schedule` is
 * unset/blank. A start failure logs and returns rather than throwing — see module doc.
 */
export async function startAbandonedCheckoutScheduler(
  deps: AbandonedCheckoutSchedulerDeps,
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
    // A boxed ref, not a reassigned `let` — same pattern as credit-expiry-scheduler.ts: the tick
    // handler closes over `queueBox` (defined before `createQueue` exists) and reads `.queue` only
    // once pg-boss actually claims a job, strictly after the synchronous assignment below.
    const queueBox: { queue?: JobQueue } = {};
    const tickTask = defineTask(
      ABANDONED_CHECKOUT_TICK_TASK,
      tickPayloadSchema,
      async () => {
        await runAbandonedCheckoutTick(deps.db, queueBox.queue as JobQueue);
      },
    );
    const noticeTask = defineAbandonedCheckoutNoticeTask(deps);

    const started = createQueue([tickTask, noticeTask], {
      connectionString: deps.connectionString,
      ...(deps.alerting !== undefined ? { alerting: deps.alerting } : {}),
    });
    queueBox.queue = started;
    await started.work(ABANDONED_CHECKOUT_NOTICE_TASK);
    await started.work(ABANDONED_CHECKOUT_TICK_TASK);
    await started.schedule(ABANDONED_CHECKOUT_TICK_TASK, cron, {});
  } catch (err) {
    log(
      `[service-license] abandoned-checkout scheduler failed to start: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

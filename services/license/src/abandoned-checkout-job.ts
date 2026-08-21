// Replay-safe abandoned-checkout pass. Cloud Tasks invokes the Cloud Run Job execution; the
// existing transactional claimed_at marker makes repeated deliveries a no-op.
import { createInMemoryQueue, type JobAlertingDeps } from "@caisson/jobs";
import {
  createPgPool,
  createPgTransactor,
  type Transactor,
} from "@caisson/tenancy-rls";
import {
  ABANDONED_CHECKOUT_TICK_TASK,
  defineAbandonedCheckoutNoticeTask,
  runAbandonedCheckoutTick,
} from "./abandoned-checkout-scheduler.ts";
import { createJobAlertingDeps, loadOpsAlertChannels } from "./alerting.ts";
import { resolveEmailer } from "./email-notify.ts";
import { requireJobDatabaseUrl, runAlertedFiniteJob } from "./finite-job.ts";
import { loadPostHogCaptureConfig } from "./posthog-capture.ts";

export interface AbandonedCheckoutJobDeps {
  db: Transactor;
  alerting: JobAlertingDeps;
}

export async function runAbandonedCheckoutJob(
  deps: AbandonedCheckoutJobDeps,
): Promise<void> {
  const queue = createInMemoryQueue([
    defineAbandonedCheckoutNoticeTask({
      db: deps.db,
      emailer: resolveEmailer(),
      posthog: loadPostHogCaptureConfig(),
    }),
  ]);
  await runAlertedFiniteJob(
    ABANDONED_CHECKOUT_TICK_TASK,
    deps.alerting,
    async () => runAbandonedCheckoutTick(deps.db, queue),
  );
}

export async function main(
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const pool = createPgPool(requireJobDatabaseUrl(env));
  try {
    await runAbandonedCheckoutJob({
      db: createPgTransactor(pool),
      alerting: createJobAlertingDeps(loadOpsAlertChannels(env)),
    });
  } finally {
    await pool.end();
  }
}

if (import.meta.main) await main();

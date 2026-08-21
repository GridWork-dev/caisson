// Finite, replay-safe Cloud Run Job for credit and updates-window expiry. Cloud Scheduler invokes
// this process; it performs one complete pass, closes its pool, and exits non-zero on any failure.
import { createInMemoryQueue, type JobAlertingDeps } from "@caisson/jobs";
import {
  createPgPool,
  createPgTransactor,
  type Transactor,
} from "@caisson/tenancy-rls";
import {
  defineCreditExpiryNoticeTask,
  defineCreditExpirySweepTask,
} from "@caisson/credits";
import { createJobAlertingDeps, loadOpsAlertChannels } from "./alerting.ts";
import {
  CREDIT_EXPIRY_TICK_TASK,
  runCreditExpiryTick,
  runUpdatesWindowExpiryTick,
} from "./credit-expiry-scheduler.ts";
import { recipientFor, resolveEmailer } from "./email-notify.ts";
import { requireJobDatabaseUrl, runAlertedFiniteJob } from "./finite-job.ts";
import { defineUpdatesWindowExpiryNoticeTask } from "./updates-window-expiry-task.ts";

export interface LicenseExpiryJobDeps {
  db: Transactor;
  alerting: JobAlertingDeps;
}

export async function runLicenseExpiryJob(
  deps: LicenseExpiryJobDeps,
): Promise<void> {
  const emailer = resolveEmailer();
  const queue = createInMemoryQueue([
    defineCreditExpirySweepTask({ db: deps.db }),
    defineCreditExpiryNoticeTask({
      db: deps.db,
      emailer,
      recipientFor: (accountId) => recipientFor(deps.db, accountId),
      dashboardUrl: "https://caisson.sh/dashboard/credits",
    }),
    defineUpdatesWindowExpiryNoticeTask({
      db: deps.db,
      emailer,
      recipientFor: (accountId) => recipientFor(deps.db, accountId),
      dashboardUrl: "https://caisson.sh/dashboard/license",
    }),
  ]);

  await runAlertedFiniteJob(
    CREDIT_EXPIRY_TICK_TASK,
    deps.alerting,
    async () => {
      await runCreditExpiryTick(deps.db, queue);
      await runUpdatesWindowExpiryTick(deps.db, queue);
    },
  );
}

export async function main(
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const pool = createPgPool(requireJobDatabaseUrl(env));
  try {
    await runLicenseExpiryJob({
      db: createPgTransactor(pool),
      alerting: createJobAlertingDeps(loadOpsAlertChannels(env)),
    });
  } finally {
    await pool.end();
  }
}

if (import.meta.main) await main();

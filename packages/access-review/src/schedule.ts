// src/schedule.ts — the access-review campaign as `@caisson-sh/jobs` tasks (ADR-0371).
//
// Two tasks ride the SAME `JobQueue` port `@caisson-sh/retention-runner`'s recurring sweep uses
// (`defineRetentionTask`): OPEN (mint a fresh campaign on a recurring cadence) and CLOSE (attempt
// to close one campaign — a no-op-safe refusal if it's neither complete nor past its deadline, per
// `closeCampaign`'s own guard). WHICH tenants/reviewers are due to open, and which open campaigns
// are due for a close attempt, is the caller's own scheduler's concern — this package only runs
// the operation once told who, exactly like the auto_90d sweep only runs the erasure once told
// which subject.
import { defineTask } from "@caisson-sh/jobs";
import type { JobQueue, TaskDefinition } from "@caisson-sh/jobs";
import { closeCampaign, openCampaign, type CampaignDeps } from "./campaign.ts";
import {
  closeCampaignSchema,
  openCampaignSchema,
  type CloseCampaignInput,
  type OpenCampaignInput,
} from "./schema.ts";

/** The `JobQueue` task name a recurring cadence enqueues to open a fresh campaign. */
export const CAMPAIGN_OPEN_TASK = "access-review.campaign_open";
/** The `JobQueue` task name a deadline sweep enqueues to attempt closing one campaign. */
export const CAMPAIGN_CLOSE_TASK = "access-review.campaign_close";

/** Define the campaign-open task. Register on a `JobQueue` (the shipped in-memory driver in
 *  dev/test; Trigger.dev in prod) and enqueue through `enqueueCampaignOpen`. */
export function defineCampaignOpenTask(
  deps: CampaignDeps,
): TaskDefinition<unknown> {
  return defineTask(CAMPAIGN_OPEN_TASK, openCampaignSchema, async (payload) => {
    await openCampaign(deps, payload);
  });
}

/** Enqueue one campaign-open, overlap-safe per (tenant, reviewer): a reviewer already queued for
 *  an open cycle is never double-enqueued while a distinct reviewer's cycle still runs in
 *  parallel — the same `singletonKey` discipline `enqueueAutoSweep` uses. */
export async function enqueueCampaignOpen(
  queue: JobQueue,
  payload: OpenCampaignInput,
): Promise<void> {
  await queue.enqueue(CAMPAIGN_OPEN_TASK, payload, {
    singletonKey: `${payload.accountId}:${payload.reviewerId}`,
  });
}

/** Define the campaign-close task. Register on a `JobQueue` and enqueue through
 *  `enqueueCampaignClose` for every open campaign a deadline-sweep scheduler finds past its
 *  window — `closeCampaign` itself refuses a premature close, so an eager or redundant poll is
 *  harmless (idempotent-safe, not just overlap-safe). */
export function defineCampaignCloseTask(
  deps: CampaignDeps,
): TaskDefinition<unknown> {
  return defineTask(
    CAMPAIGN_CLOSE_TASK,
    closeCampaignSchema,
    async (payload) => {
      await closeCampaign(deps, payload);
    },
  );
}

/** Enqueue one campaign-close attempt, overlap-safe per (tenant, campaign). */
export async function enqueueCampaignClose(
  queue: JobQueue,
  payload: CloseCampaignInput,
): Promise<void> {
  await queue.enqueue(CAMPAIGN_CLOSE_TASK, payload, {
    singletonKey: `${payload.accountId}:${payload.campaignId}`,
  });
}

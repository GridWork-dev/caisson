// G24 (buyer-lifecycle audit 2026-07-07) — the updates-window expiry notice as a `@caisson/jobs`
// task, mirroring `@caisson/credits`'s `expiry-task.ts` shape exactly (same singletonKey overlap
// safety, same `.strict()` payload boundary). Lives in services/license (not @caisson/credits)
// because the updates window is an `entitlement_grant` concept this service owns.
import { defineTask } from "@caisson/jobs";
import type { JobQueue, TaskDefinition } from "@caisson/jobs";
import { strictObject } from "@caisson/kernel";
import type { Transactor } from "@caisson/tenancy-rls";
import { withTenant } from "@caisson/tenancy-rls";
import { z } from "zod";
import {
  sweepUpdatesWindowExpiryNotices,
  type UpdatesWindowExpiryEmailer,
} from "./entitlement-store.ts";

/** The T-30d updates-window expiring-soon email task name. */
export const UPDATES_WINDOW_EXPIRY_NOTICE_TASK =
  "entitlement.updates_window_expiry_notice";

export const updatesWindowExpiryPayloadSchema = strictObject({
  accountId: z.string().min(1),
});

export type UpdatesWindowExpiryPayload = z.infer<
  typeof updatesWindowExpiryPayloadSchema
>;

export interface UpdatesWindowExpiryNoticeTaskDeps {
  db: Transactor;
  /** Driver-gated: `null` when email is unconfigured — the task is then an honest no-op. */
  emailer: UpdatesWindowExpiryEmailer | null;
  /** Resolve an account's notification address; `null` → skip (no address, no send). */
  recipientFor: (accountId: string) => Promise<string | null>;
  /** The email CTA link — the buyer license/dashboard page. */
  dashboardUrl: string;
  /** Notice window in days (default 30, the credits-expiry precedent). */
  withinDays?: number;
}

/** Define the T-30d updates-window expiry-notice sweep as a `TaskDefinition` — register on a `JobQueue`. */
export function defineUpdatesWindowExpiryNoticeTask(
  deps: UpdatesWindowExpiryNoticeTaskDeps,
): TaskDefinition<unknown> {
  return defineTask(
    UPDATES_WINDOW_EXPIRY_NOTICE_TASK,
    updatesWindowExpiryPayloadSchema,
    async (payload: UpdatesWindowExpiryPayload): Promise<void> => {
      const emailer = deps.emailer;
      if (emailer === null) return; // driver-gated: unconfigured email is a no-op
      const recipient = await deps.recipientFor(payload.accountId);
      if (recipient === null) return;
      await withTenant(deps.db, payload.accountId, (tx) =>
        sweepUpdatesWindowExpiryNotices(tx, payload.accountId, {
          recipient,
          emailer,
          dashboardUrl: deps.dashboardUrl,
          ...(deps.withinDays !== undefined
            ? { withinDays: deps.withinDays }
            : {}),
        }),
      );
    },
  );
}

/** Enqueue one account's updates-window expiry sweep (overlap-safe, the retention-runner shape). */
export async function enqueueUpdatesWindowExpiryNotice(
  queue: JobQueue,
  payload: UpdatesWindowExpiryPayload,
): Promise<void> {
  await queue.enqueue(UPDATES_WINDOW_EXPIRY_NOTICE_TASK, payload, {
    singletonKey: payload.accountId,
  });
}

// The credit-expiry sweeps as `@caisson-sh/jobs` tasks (ADR-0252 Decisions 5/6b), mirroring
// `@caisson-sh/retention-runner`'s schedule shape: per-account payloads, `singletonKey` overlap
// safety, and the queue's `.strict()` boundary validation. A scheduler enqueues one payload per
// wallet account on its cron tick; both sweeps are idempotent, so a replayed tick is a no-op.
import { defineTask } from "@caisson-sh/jobs";
import type { JobQueue, TaskDefinition } from "@caisson-sh/jobs";
import { strictObject } from "@caisson-sh/kernel";
import type { Transactor } from "@caisson-sh/tenancy-rls";
import { withTenant } from "@caisson-sh/tenancy-rls";
import {
  sweepExpiredGrants,
  sweepExpiryNotices,
  type ExpiryNoticeEmailer,
} from "./credits.ts";
import { z } from "zod";

/** The residue-burn sweep task name (grants past `expires_at`). */
export const CREDIT_EXPIRY_SWEEP_TASK = "credits.expiry_sweep";
/** The T-30d expiring-soon email task name. */
export const CREDIT_EXPIRY_NOTICE_TASK = "credits.expiry_notice";

export const expiryPayloadSchema = strictObject({
  accountId: z.string().min(1),
});

export type ExpiryPayload = z.infer<typeof expiryPayloadSchema>;

export interface ExpirySweepTaskDeps {
  db: Transactor;
}

/** Define the residue-burn sweep as a `TaskDefinition` — register on a `JobQueue`. */
export function defineCreditExpirySweepTask(
  deps: ExpirySweepTaskDeps,
): TaskDefinition<unknown> {
  return defineTask(
    CREDIT_EXPIRY_SWEEP_TASK,
    expiryPayloadSchema,
    async (payload: ExpiryPayload): Promise<void> => {
      await withTenant(deps.db, payload.accountId, (tx) =>
        sweepExpiredGrants(tx, payload.accountId),
      );
    },
  );
}

export interface ExpiryNoticeTaskDeps {
  db: Transactor;
  /**
   * The transactional emailer, or null when email is unconfigured — the task is then an honest
   * no-op, exactly like the existing driver-gated templates (no config → nothing sends).
   */
  emailer: ExpiryNoticeEmailer | null;
  /** Resolve an account's notification address; null → skip (no address, no send). */
  recipientFor: (accountId: string) => Promise<string | null>;
  /** The email CTA link — the buyer credits dashboard. */
  dashboardUrl: string;
  /** Notice window in days (default 30, ADR-0252 Decision 6b). */
  withinDays?: number;
}

/** Define the T-30d expiry-notice sweep as a `TaskDefinition` — register on a `JobQueue`. */
export function defineCreditExpiryNoticeTask(
  deps: ExpiryNoticeTaskDeps,
): TaskDefinition<unknown> {
  return defineTask(
    CREDIT_EXPIRY_NOTICE_TASK,
    expiryPayloadSchema,
    async (payload: ExpiryPayload): Promise<void> => {
      const emailer = deps.emailer;
      if (emailer === null) return; // driver-gated: unconfigured email is a no-op
      const recipient = await deps.recipientFor(payload.accountId);
      if (recipient === null) return;
      await withTenant(deps.db, payload.accountId, (tx) =>
        sweepExpiryNotices(tx, payload.accountId, {
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

/**
 * Enqueue one account's expiry sweep, overlap-safe: the `singletonKey` is the account id, so a
 * slow sweep never stacks a second instance for the same account while distinct accounts run in
 * parallel (the retention-runner precedent, ADR-0229 row 56).
 */
export async function enqueueCreditExpirySweep(
  queue: JobQueue,
  payload: ExpiryPayload,
): Promise<void> {
  await queue.enqueue(CREDIT_EXPIRY_SWEEP_TASK, payload, {
    singletonKey: payload.accountId,
  });
}

/** Enqueue one account's expiry-notice sweep (same overlap-safety shape as the burn sweep). */
export async function enqueueCreditExpiryNotice(
  queue: JobQueue,
  payload: ExpiryPayload,
): Promise<void> {
  await queue.enqueue(CREDIT_EXPIRY_NOTICE_TASK, payload, {
    singletonKey: payload.accountId,
  });
}

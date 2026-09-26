// @caisson-sh/retention-runner — the recurring `auto_90d` sweep as a `@caisson-sh/jobs` task (ADR-0152).
// `ccpa_request`/`operator_manual` are operator/subject-triggered one-shot calls straight
// into `runErasure` (no queue — see README); only the recurring sweep is enqueued.
import { defineTask } from "@caisson-sh/jobs";
import type { JobQueue, TaskDefinition } from "@caisson-sh/jobs";
import { strictObject } from "@caisson-sh/kernel";
import { z } from "zod";
import type { ErasureTarget } from "./targets.ts";
import type { RetentionAuditSink } from "./audit-sink.ts";
import { runErasure } from "./run-erasure.ts";

/** The `JobQueue` task name the `auto_90d` sweep enqueues under. */
export const AUTO_90D_SWEEP_TASK = "retention.auto_90d_sweep";

/** The sweep payload: which subject/tenant to erase. `.strict()` — no extra fields. */
export const autoSweepPayloadSchema = strictObject({
  subjectId: z.string().min(1),
  tenantId: z.string().min(1),
});

export type AutoSweepPayload = z.infer<typeof autoSweepPayloadSchema>;

export interface RetentionTaskDeps {
  targets: ErasureTarget[];
  sink: RetentionAuditSink;
  /** Injected clock, forwarded to `runErasure`; defaults to the real clock. */
  now?: () => number;
}

/**
 * Define the `auto_90d` sweep as a `@caisson-sh/jobs` `TaskDefinition`. Register it on a `JobQueue`
 * (the shipped `createInMemoryQueue` in dev/test; Trigger.dev in prod, per ADR-0152) and enqueue
 * `AUTO_90D_SWEEP_TASK` with an `AutoSweepPayload` for each subject due for erasure.
 */
/**
 * Enqueue one subject's `auto_90d` erasure sweep, overlap-safe (ADR-0229 row 56). The `singletonKey`
 * is per (tenant, subject) so a long-running erasure can never DOUBLE-RUN for the same subject while
 * distinct subjects still sweep in parallel — the real consumer of the jobs `singletonKey` option. The
 * one enqueue site the recurring scheduler should call (per subject due for erasure); `queue.enqueue`
 * validates the payload against `autoSweepPayloadSchema` at the boundary.
 *
 * `tenantId`/`subjectId` are opaque account/subject ids (no `:`), so a plain `:`-join is an
 * unambiguous key. Length-prefix them if an id class ever contains a colon.
 */
export async function enqueueAutoSweep(
  queue: JobQueue,
  payload: AutoSweepPayload,
): Promise<void> {
  await queue.enqueue(AUTO_90D_SWEEP_TASK, payload, {
    singletonKey: `${payload.tenantId}:${payload.subjectId}`,
  });
}

export function defineRetentionTask(
  deps: RetentionTaskDeps,
): TaskDefinition<unknown> {
  return defineTask(
    AUTO_90D_SWEEP_TASK,
    autoSweepPayloadSchema,
    async (payload: AutoSweepPayload): Promise<void> => {
      await runErasure(
        {
          subjectId: payload.subjectId,
          tenantId: payload.tenantId,
          reason: "auto_90d",
        },
        deps.targets,
        deps.sink,
        deps.now,
      );
    },
  );
}

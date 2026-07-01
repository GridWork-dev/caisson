// @caisson/retention-runner — the recurring `auto_90d` sweep as a `@caisson/jobs` task (ADR-0152,
// Fork 3). `ccpa_request`/`operator_manual` are operator/subject-triggered one-shot calls straight
// into `runErasure` (no queue — see README); only the recurring sweep is enqueued.
import { defineTask } from "@caisson/jobs";
import type { TaskDefinition } from "@caisson/jobs";
import { strictObject } from "@caisson/kernel";
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
 * Define the `auto_90d` sweep as a `@caisson/jobs` `TaskDefinition`. Register it on a `JobQueue`
 * (the shipped `createInMemoryQueue` in dev/test; Trigger.dev in prod, per ADR-0152) and enqueue
 * `AUTO_90D_SWEEP_TASK` with an `AutoSweepPayload` for each subject due for erasure.
 */
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

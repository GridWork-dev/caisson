import { describe, expect, test } from "bun:test";
import { createInMemoryQueue } from "@caisson-sh/jobs";
import type { EnqueueOptions, JobQueue } from "@caisson-sh/jobs";
import { createCaptureTarget } from "./targets.ts";
import { createCaptureAuditSink } from "./audit-sink.ts";
import {
  AUTO_90D_SWEEP_TASK,
  defineRetentionTask,
  enqueueAutoSweep,
} from "./schedule.ts";

/** A `JobQueue` that records every enqueue instead of running it — asserts the options passed. */
function recordingQueue(): JobQueue & {
  readonly calls: ReadonlyArray<{
    name: string;
    payload: unknown;
    options: EnqueueOptions | undefined;
  }>;
} {
  const calls: Array<{
    name: string;
    payload: unknown;
    options: EnqueueOptions | undefined;
  }> = [];
  return {
    calls,
    async enqueue(name, payload, options) {
      calls.push({ name, payload, options });
    },
  };
}

describe("defineRetentionTask", () => {
  test("the sweep task enqueues + runs on an in-memory JobQueue", async () => {
    const target = createCaptureTarget();
    const sink = createCaptureAuditSink();
    const queue = createInMemoryQueue([
      defineRetentionTask({ targets: [target], sink, now: () => 3_000 }),
    ]);

    await queue.enqueue(AUTO_90D_SWEEP_TASK, {
      subjectId: "sub_5",
      tenantId: "ten_5",
    });

    expect(target.erased).toEqual([{ subjectId: "sub_5", tenantId: "ten_5" }]);
    expect(sink.rows).toEqual([
      {
        subjectId: "sub_5",
        tenantId: "ten_5",
        reason: "auto_90d",
        results: [{ target: "capture", ok: true }],
        at: 3_000,
      },
    ]);
  });
});

describe("enqueueAutoSweep (overlap-safe, ADR-0229 row 56)", () => {
  test("enqueues the sweep with a per-(tenant,subject) singletonKey", async () => {
    const q = recordingQueue();
    await enqueueAutoSweep(q, { subjectId: "sub_5", tenantId: "ten_5" });
    expect(q.calls).toEqual([
      {
        name: AUTO_90D_SWEEP_TASK,
        payload: { subjectId: "sub_5", tenantId: "ten_5" },
        options: { singletonKey: "ten_5:sub_5" },
      },
    ]);
  });

  test("runs the sweep end-to-end on an in-memory queue", async () => {
    const target = createCaptureTarget();
    const sink = createCaptureAuditSink();
    const queue = createInMemoryQueue([
      defineRetentionTask({ targets: [target], sink, now: () => 3_000 }),
    ]);

    await enqueueAutoSweep(queue, { subjectId: "sub_9", tenantId: "ten_9" });

    expect(target.erased).toEqual([{ subjectId: "sub_9", tenantId: "ten_9" }]);
  });
});

import { describe, expect, test } from "bun:test";
import { createInMemoryQueue } from "@caisson/jobs";
import { createCaptureTarget } from "./targets.ts";
import { createCaptureAuditSink } from "./audit-sink.ts";
import { AUTO_90D_SWEEP_TASK, defineRetentionTask } from "./schedule.ts";

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

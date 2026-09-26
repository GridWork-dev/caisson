import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson-sh/kernel";
import type { ErasureTarget } from "./targets.ts";
import { createCaptureTarget } from "./targets.ts";
import { createCaptureAuditSink } from "./audit-sink.ts";
import { runErasure } from "./run-erasure.ts";
import type { ErasureRequest } from "./types.ts";

/** A target that always throws — for exercising per-target error isolation. */
function createFailingTarget(name: string, message: string): ErasureTarget {
  return {
    name,
    erase: () => Promise.reject(new Error(message)),
  };
}

describe("runErasure", () => {
  test("runs every target even when one throws — per-target isolation", async () => {
    const good = createCaptureTarget("good");
    const bad = createFailingTarget("bad", "store unreachable");
    const sink = createCaptureAuditSink();

    const result = await runErasure(
      { subjectId: "sub_1", tenantId: "ten_1", reason: "ccpa_request" },
      [good, bad],
      sink,
      () => 1_000,
    );

    // The failing target's error never aborted the run — the good target still ran.
    expect(good.erased).toEqual([{ subjectId: "sub_1", tenantId: "ten_1" }]);
    expect(result.results).toEqual([
      { target: "good", ok: true },
      { target: "bad", ok: false, error: "store unreachable" },
    ]);
  });

  test("writes one reason-tagged audit row per run", async () => {
    const sink = createCaptureAuditSink();
    const target = createCaptureTarget();

    await runErasure(
      { subjectId: "sub_2", tenantId: "ten_2", reason: "auto_90d" },
      [target],
      sink,
      () => 2_000,
    );

    expect(sink.rows).toEqual([
      {
        subjectId: "sub_2",
        tenantId: "ten_2",
        reason: "auto_90d",
        results: [{ target: "capture", ok: true }],
        at: 2_000,
      },
    ]);
  });

  test("rejects an unknown field", async () => {
    const sink = createCaptureAuditSink();
    const malformed = {
      subjectId: "sub_3",
      tenantId: "ten_3",
      reason: "operator_manual",
      extra: "nope",
    } as unknown as ErasureRequest;
    await expect(runErasure(malformed, [], sink)).rejects.toThrow(
      ValidationError,
    );
  });

  test("rejects a bad reason", async () => {
    const sink = createCaptureAuditSink();
    const malformed = {
      subjectId: "sub_4",
      tenantId: "ten_4",
      reason: "not_a_real_reason",
    } as unknown as ErasureRequest;
    await expect(runErasure(malformed, [], sink)).rejects.toThrow(
      ValidationError,
    );
  });
});

import { describe, expect, test } from "bun:test";
import { ConflictError, NotFoundError } from "@caisson-sh/kernel";
import { createMemoryRunStateStore } from "./run-state.ts";

describe("createMemoryRunStateStore — park/approve/deny/claimResume/finish CAS", () => {
  test("park then approve then claimResume returns the parked material exactly once", async () => {
    const s = createMemoryRunStateStore();
    await s.park({
      runId: "run-1",
      toolCallId: "call-1",
      resumeSeq: 5,
      parkedState: { messages: ["a"] },
    });
    expect(await s.read("run-1")).toMatchObject({
      status: "parked",
      pendingToolCallId: "call-1",
      resumeSeq: 5,
    });

    const snap = await s.approve("run-1", "call-1");
    expect(snap.status).toBe("running");

    const material = await s.claimResume("run-1", "call-1");
    expect(material.resumeSeq).toBe(5);
    expect(material.parkedState).toEqual({ messages: ["a"] });

    // A second claim of the SAME approval must never succeed (no double execution).
    await expect(s.claimResume("run-1", "call-1")).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  test("double-approval is idempotent: the second call returns the same success, no re-mutation", async () => {
    const s = createMemoryRunStateStore();
    await s.park({
      runId: "run-2",
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: null,
    });
    const first = await s.approve("run-2", "call-1");
    const second = await s.approve("run-2", "call-1");
    expect(first.wasNoop).toBe(false);
    expect(second.wasNoop).toBe(true);
    const { wasNoop: _f, ...firstRest } = first;
    const { wasNoop: _s, ...secondRest } = second;
    expect(firstRest).toEqual(secondRest);
  });

  test("resumeSeqAdvance is applied exactly once, on the winning approve only", async () => {
    const s = createMemoryRunStateStore();
    await s.park({
      runId: "run-2b",
      toolCallId: "call-1",
      resumeSeq: 5,
      parkedState: null,
    });
    const first = await s.approve("run-2b", "call-1", 1);
    expect(first.resumeSeq).toBe(6);
    const second = await s.approve("run-2b", "call-1", 1);
    expect(second.resumeSeq).toBe(6); // NOT re-advanced to 7 on the idempotent retry
  });

  test("deny finishes the run and is idempotent on retry", async () => {
    const s = createMemoryRunStateStore();
    await s.park({
      runId: "run-3",
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: null,
    });
    const first = await s.deny("run-3", "call-1");
    expect(first.status).toBe("finished");
    expect(first.wasNoop).toBe(false);
    const second = await s.deny("run-3", "call-1");
    expect(second.wasNoop).toBe(true);
    expect(second.status).toBe(first.status);
  });

  test("approve after deny (mismatched decision) is rejected, never silently accepted", async () => {
    const s = createMemoryRunStateStore();
    await s.park({
      runId: "run-4",
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: null,
    });
    await s.deny("run-4", "call-1");
    await expect(s.approve("run-4", "call-1")).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  test("approve/deny/claimResume/finish on an unknown runId fail closed", async () => {
    const s = createMemoryRunStateStore();
    await expect(s.approve("nope", "call-1")).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(s.deny("nope", "call-1")).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(s.claimResume("nope", "call-1")).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(s.finish("nope")).rejects.toBeInstanceOf(NotFoundError);
  });

  test("approve with a mismatched toolCallId is rejected", async () => {
    const s = createMemoryRunStateStore();
    await s.park({
      runId: "run-5",
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: null,
    });
    await expect(s.approve("run-5", "call-wrong")).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  test("re-park after a claimed resume succeeds; parking an unclaimed/already-parked run fails closed", async () => {
    const s = createMemoryRunStateStore();
    await s.park({
      runId: "run-6",
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: null,
    });
    await s.approve("run-6", "call-1");
    await s.claimResume("run-6", "call-1");

    // The run is "running" with no unclaimed pending call — a second gated tool may re-park it.
    await s.park({
      runId: "run-6",
      toolCallId: "call-2",
      resumeSeq: 3,
      parkedState: { messages: ["b"] },
    });
    expect(await s.read("run-6")).toMatchObject({
      status: "parked",
      pendingToolCallId: "call-2",
      resumeSeq: 3,
    });

    // Parking again while ALREADY parked (unclaimed) is a caller bug — fail closed.
    await expect(
      s.park({
        runId: "run-6",
        toolCallId: "call-3",
        resumeSeq: 4,
        parkedState: null,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  test("finish is terminal from any status", async () => {
    const s = createMemoryRunStateStore();
    await s.park({
      runId: "run-7",
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: null,
    });
    await s.finish("run-7");
    expect((await s.read("run-7"))?.status).toBe("finished");
  });

  test("an unparked run reads back undefined", async () => {
    const s = createMemoryRunStateStore();
    expect(await s.read("nope")).toBeUndefined();
  });
});

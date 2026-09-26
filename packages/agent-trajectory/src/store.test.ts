import { describe, expect, test } from "bun:test";
import { ConflictError, parseStrict } from "@caisson-sh/kernel";
import { TrajectoryEvent, createMemoryTrajectoryStore } from "./index.ts";

const AT = "2026-07-16T10:00:00.000Z";

function usage(seq: number, credits: number): TrajectoryEvent {
  return parseStrict(TrajectoryEvent, {
    eventId: "11111111-1111-4111-8111-111111111111",
    runId: "run-1",
    seq,
    version: 1,
    occurredAt: AT,
    kind: "model.usage",
    payload: {
      provider: "anthropic",
      model: "opus",
      inputTokens: 10,
      outputTokens: 2,
      credits,
      billingStatus: "metered",
    },
  });
}

describe("createMemoryTrajectoryStore — append-only", () => {
  test("sequential appends are read back in seq order", async () => {
    const store = createMemoryTrajectoryStore();
    await store.append(usage(0, 1));
    await store.append(usage(1, 2));
    const events = await store.read("run-1");
    expect(events.map((e) => e.seq)).toEqual([0, 1]);
  });

  test("re-appending a byte-identical event at a recorded seq is idempotent", async () => {
    const store = createMemoryTrajectoryStore();
    await store.append(usage(0, 1));
    await store.append(usage(0, 1)); // duplicate delivery / retry after dropped ack
    const events = await store.read("run-1");
    expect(events).toHaveLength(1);
  });

  test("a rewrite (same seq, different content) is rejected", async () => {
    const store = createMemoryTrajectoryStore();
    await store.append(usage(0, 1));
    await expect(store.append(usage(0, 999))).rejects.toThrow(ConflictError);
  });

  test("a seq gap is rejected", async () => {
    const store = createMemoryTrajectoryStore();
    await store.append(usage(0, 1));
    await expect(store.append(usage(2, 3))).rejects.toThrow(ConflictError);
  });

  test("read returns a defensive copy — mutating it never touches the store", async () => {
    const store = createMemoryTrajectoryStore();
    await store.append(usage(0, 1));
    const copy = await store.read("run-1");
    copy.pop();
    expect(await store.read("run-1")).toHaveLength(1);
  });

  test("an unknown run reads back empty", async () => {
    const store = createMemoryTrajectoryStore();
    expect(await store.read("nope")).toEqual([]);
  });
});

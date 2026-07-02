// Reflexivity-queue tests (ADR-0208). Agreement → no enqueue; disagreement → enqueued; consolidation
// dedups by caseId (latest wins) and caps — and never produces an `EvalCase` (only a candidate list).
import { describe, expect, test } from "bun:test";
import {
  captureDisagreement,
  consolidateReflexivityQueue,
  flagsDisagreement,
  InMemoryReflexivityQueueStore,
  reflexivityCandidateSchema,
} from "./reflexivity-queue.ts";

describe("flagsDisagreement", () => {
  test("agreement is false", () => {
    expect(flagsDisagreement("pass", "pass")).toBe(false);
    expect(flagsDisagreement("fail", "fail")).toBe(false);
  });

  test("disagreement is true", () => {
    expect(flagsDisagreement("pass", "fail")).toBe(true);
    expect(flagsDisagreement("fail", "pass")).toBe(true);
  });
});

describe("captureDisagreement", () => {
  test("agreement → no enqueue (returns undefined, queue stays empty)", async () => {
    const store = new InMemoryReflexivityQueueStore();
    const result = await captureDisagreement(store, {
      evalName: "compliance-answer",
      caseId: "c1",
      input: {},
      output: "the answer",
      modelVerdict: "pass",
      humanVerdict: "pass",
    });
    expect(result).toBeUndefined();
    expect(store.list("compliance-answer")).toHaveLength(0);
  });

  test("disagreement → enqueued with a stamped id + capturedAt", async () => {
    const store = new InMemoryReflexivityQueueStore();
    const result = await captureDisagreement(store, {
      evalName: "compliance-answer",
      caseId: "c1",
      input: { q: "x" },
      output: "the answer",
      modelVerdict: "pass",
      humanVerdict: "fail",
    });
    expect(result).toBeDefined();
    expect(store.list("compliance-answer")).toHaveLength(1);
    expect(result?.caseId).toBe("c1");
    expect(result?.modelVerdict).toBe("pass");
    expect(result?.humanVerdict).toBe("fail");
    expect(() => reflexivityCandidateSchema.parse(result)).not.toThrow();
  });
});

describe("consolidateReflexivityQueue", () => {
  test("dedups by caseId — the latest enqueue wins", async () => {
    const store = new InMemoryReflexivityQueueStore();
    await captureDisagreement(store, {
      evalName: "e",
      caseId: "c1",
      input: {},
      output: "first",
      modelVerdict: "pass",
      humanVerdict: "fail",
    });
    await captureDisagreement(store, {
      evalName: "e",
      caseId: "c1",
      input: {},
      output: "second (re-captured)",
      modelVerdict: "fail",
      humanVerdict: "pass",
    });
    const consolidated = await consolidateReflexivityQueue(store, "e");
    expect(consolidated).toHaveLength(1);
    expect(consolidated[0]?.output).toBe("second (re-captured)");
  });

  test("caps at maxCases", async () => {
    const store = new InMemoryReflexivityQueueStore();
    for (const caseId of ["a", "b", "c", "d"]) {
      await captureDisagreement(store, {
        evalName: "e",
        caseId,
        input: {},
        output: "x",
        modelVerdict: "pass",
        humanVerdict: "fail",
      });
    }
    const consolidated = await consolidateReflexivityQueue(store, "e", {
      maxCases: 2,
    });
    expect(consolidated).toHaveLength(2);
  });

  test("scopes strictly by evalName", async () => {
    const store = new InMemoryReflexivityQueueStore();
    await captureDisagreement(store, {
      evalName: "eval-a",
      caseId: "c1",
      input: {},
      output: "x",
      modelVerdict: "pass",
      humanVerdict: "fail",
    });
    expect(await consolidateReflexivityQueue(store, "eval-b")).toHaveLength(0);
  });

  test("returns candidates, never something shaped like an EvalCase", async () => {
    const store = new InMemoryReflexivityQueueStore();
    await captureDisagreement(store, {
      evalName: "e",
      caseId: "c1",
      input: {},
      output: "x",
      modelVerdict: "pass",
      humanVerdict: "fail",
    });
    const consolidated = await consolidateReflexivityQueue(store, "e");
    for (const candidate of consolidated) {
      expect(candidate).not.toHaveProperty("expected");
      expect(candidate).toHaveProperty("modelVerdict");
      expect(candidate).toHaveProperty("humanVerdict");
    }
  });
});

describe("reflexivityCandidateSchema boundary", () => {
  test("rejects an unknown field (.strict)", () => {
    expect(() =>
      reflexivityCandidateSchema.parse({
        id: crypto.randomUUID(),
        evalName: "e",
        caseId: "c",
        input: {},
        output: "x",
        modelVerdict: "pass",
        humanVerdict: "fail",
        capturedAt: new Date().toISOString(),
        sneaky: true,
      }),
    ).toThrow();
  });
});

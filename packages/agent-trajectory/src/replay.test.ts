import { describe, expect, test } from "bun:test";
import { parseStrict } from "@caisson/kernel";
import { TrajectoryEvent, project } from "./index.ts";

const UUID = "11111111-1111-4111-8111-111111111111";
const AT = "2026-07-16T10:00:00.000Z";
const DIGEST = "a".repeat(64);

let seq = 0;
function e(kind: string, payload: unknown): TrajectoryEvent {
  return parseStrict(TrajectoryEvent, {
    eventId: UUID,
    runId: "run-1",
    seq: seq++,
    version: 1,
    occurredAt: AT,
    kind,
    payload,
  });
}

function sampleRun(): TrajectoryEvent[] {
  seq = 0;
  return [
    e("run.started", { agentId: "agent-a" }),
    e("step.started", { stepId: "s1", depth: 0, label: "root" }),
    e("step.started", {
      stepId: "s2",
      parentStepId: "s1",
      depth: 1,
      label: "subagent",
    }),
    e("model.usage", {
      provider: "anthropic",
      model: "opus",
      inputTokens: 100,
      outputTokens: 20,
      cachedInputTokens: 40,
      credits: 5,
      billingStatus: "metered",
    }),
    e("model.usage", {
      provider: "anthropic",
      model: "haiku",
      inputTokens: 50,
      outputTokens: 10,
      credits: 0,
      billingStatus: "estimated",
    }),
    e("model.usage", {
      provider: "openai",
      model: "gpt-5.2-codex",
      inputTokens: 30,
      outputTokens: 6,
      credits: 2,
      billingStatus: "priced",
      priceBookVersion: "2026-06-01",
    }),
    e("checkpoint", {
      checkpointId: "c1",
      label: "after-usage",
      state: { digest: DIGEST, byteLength: 16 },
    }),
    e("step.finished", { stepId: "s2", status: "ok" }),
    e("step.finished", { stepId: "s1", status: "error" }),
    e("run.finished", { status: "completed" }),
  ];
}

describe("project — deterministic projection", () => {
  test("shuffled arrival yields a byte-identical projection (resolved by seq)", () => {
    const ordered = sampleRun();
    const reversed = [...ordered].reverse();
    const rotated = [...ordered.slice(4), ...ordered.slice(0, 4)]; // a different permutation
    expect(JSON.stringify(project(reversed))).toBe(
      JSON.stringify(project(ordered)),
    );
    expect(JSON.stringify(project(rotated))).toBe(
      JSON.stringify(project(ordered)),
    );
  });

  test("status reflects run.finished", () => {
    expect(project(sampleRun()).status).toBe("completed");
  });

  test("usage totals aggregate per billingStatus band", () => {
    const p = project(sampleRun());
    expect(p.usageTotals.metered).toEqual({
      inputTokens: 100,
      outputTokens: 20,
      cachedInputTokens: 40,
      credits: 5,
    });
    expect(p.usageTotals.priced).toEqual({
      inputTokens: 30,
      outputTokens: 6,
      cachedInputTokens: 0,
      credits: 2,
    });
    expect(p.usageTotals.estimated).toEqual({
      inputTokens: 50,
      outputTokens: 10,
      cachedInputTokens: 0,
      credits: 0,
    });
    expect(p.usageTotals.unsupported).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      credits: 0,
    });
  });

  test("usageTotals bands serialize in the fixed order (ADR-0360 U-4 byte contract)", () => {
    expect(Object.keys(project(sampleRun()).usageTotals)).toEqual([
      "metered",
      "priced",
      "estimated",
      "unsupported",
    ]);
  });

  test("step tree nests the subagent under its parent with per-step status", () => {
    const p = project(sampleRun());
    expect(p.steps).toHaveLength(1);
    const root = p.steps[0];
    expect(root?.stepId).toBe("s1");
    expect(root?.status).toBe("error");
    expect(root?.children).toHaveLength(1);
    expect(root?.children[0]?.stepId).toBe("s2");
    expect(root?.children[0]?.depth).toBe(1);
    expect(root?.children[0]?.status).toBe("ok");
  });

  test("checkpoints are recorded with their seq", () => {
    const p = project(sampleRun());
    expect(p.checkpoints).toHaveLength(1);
    expect(p.checkpoints[0]?.checkpointId).toBe("c1");
  });

  test("an empty log projects to a pending run with zeroed totals", () => {
    const p = project([]);
    expect(p.status).toBe("pending");
    expect(p.steps).toEqual([]);
    expect(p.checkpoints).toEqual([]);
    expect(p.usageTotals.metered.credits).toBe(0);
  });
});

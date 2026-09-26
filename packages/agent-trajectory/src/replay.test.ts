import { describe, expect, test } from "bun:test";
import { parseStrict } from "@caisson-sh/kernel";
import { TrajectoryEvent, project, projectToolCalls } from "./index.ts";

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

  // BYTE-STABILITY PIN (ADR-0360 U-7, PLAN task 1): `project()`/`RunProjection` must not change
  // shape for any existing input — the S2a `priced` band was the one recorded delta, nothing
  // since. `projectToolCalls` (below) is a SIBLING projection and must never touch this literal.
  test("project() output is byte-identical to the pinned literal (regression pin)", () => {
    expect(JSON.stringify(project(sampleRun()))).toBe(
      '{"runId":"run-1","status":"completed","steps":[{"stepId":"s1","depth":0,"label":"root","status":"error","children":[{"stepId":"s2","parentStepId":"s1","depth":1,"label":"subagent","status":"ok","children":[]}]}],"usageTotals":{"metered":{"inputTokens":100,"outputTokens":20,"cachedInputTokens":40,"credits":5},"priced":{"inputTokens":30,"outputTokens":6,"cachedInputTokens":0,"credits":2},"estimated":{"inputTokens":50,"outputTokens":10,"cachedInputTokens":0,"credits":0},"unsupported":{"inputTokens":0,"outputTokens":0,"cachedInputTokens":0,"credits":0}},"checkpoints":[{"checkpointId":"c1","label":"after-usage","seq":6}]}',
    );
  });
});

// --- projectToolCalls — a SIBLING projection (ADR-0360 U-7) -------------------------------------

function toolCallRun(): TrajectoryEvent[] {
  seq = 0;
  const args = { digest: "b".repeat(64), byteLength: 12 };
  const result = { digest: "c".repeat(64), byteLength: 4 };
  return [
    e("run.started", { agentId: "agent-a" }),
    e("step.started", { stepId: "s1", depth: 0 }),
    // call-1: proposed, approved, then a result (the ordinary gated-and-executed path).
    e("tool.proposed", {
      stepId: "s1",
      toolCallId: "call-1",
      name: "send_email",
      args,
    }),
    e("tool.approved", { toolCallId: "call-1", actor: "ops@example.com" }),
    e("tool.result", { toolCallId: "call-1", ok: true, result }),
    // call-2: proposed then denied — never executes, so no tool.result follows.
    e("tool.proposed", {
      stepId: "s1",
      toolCallId: "call-2",
      name: "delete_all",
      args,
    }),
    e("tool.denied", {
      toolCallId: "call-2",
      actor: "ops@example.com",
      reason: "too risky",
    }),
    // call-3: proposed, executes without ever being gated (no approval event at all).
    e("tool.proposed", {
      stepId: "s1",
      toolCallId: "call-3",
      name: "ping",
      args,
    }),
    e("tool.result", { toolCallId: "call-3", ok: false, result, exitCode: 1 }),
    e("step.finished", { stepId: "s1", status: "ok" }),
    e("run.finished", { status: "completed" }),
  ];
}

describe("projectToolCalls — a sibling projection", () => {
  test("folds proposed/approved/result into one entry, ordered by proposal seq", () => {
    const calls = projectToolCalls(toolCallRun());
    expect(calls.map((c) => c.toolCallId)).toEqual([
      "call-1",
      "call-2",
      "call-3",
    ]);

    const first = calls[0];
    expect(first?.name).toBe("send_email");
    expect(first?.stepId).toBe("s1");
    expect(first?.args.digest).toBe("b".repeat(64));
    expect(first?.approval).toEqual({
      outcome: "approved",
      actor: "ops@example.com",
      seq: 3,
    });
    expect(first?.result).toEqual({ ok: true, seq: 4 });
  });

  test("a denied call carries its approval but no result", () => {
    const calls = projectToolCalls(toolCallRun());
    const denied = calls.find((c) => c.toolCallId === "call-2");
    expect(denied?.approval).toEqual({
      outcome: "denied",
      actor: "ops@example.com",
      seq: 6,
      reason: "too risky",
    });
    expect(denied?.result).toBeUndefined();
  });

  test("a never-gated call has no approval but does have a result (incl. exitCode)", () => {
    const calls = projectToolCalls(toolCallRun());
    const ungated = calls.find((c) => c.toolCallId === "call-3");
    expect(ungated?.approval).toBeUndefined();
    expect(ungated?.result).toEqual({ ok: false, seq: 8, exitCode: 1 });
  });

  test("shuffled arrival yields the same fold (resolved by seq, like project())", () => {
    const ordered = toolCallRun();
    const reversed = [...ordered].reverse();
    expect(JSON.stringify(projectToolCalls(reversed))).toBe(
      JSON.stringify(projectToolCalls(ordered)),
    );
  });

  test("an approval/result for a toolCallId with no tool.proposed is dropped, not synthesized", () => {
    seq = 0;
    const orphan = [
      e("run.started", { agentId: "agent-a" }),
      e("tool.approved", { toolCallId: "ghost", actor: "ops@example.com" }),
    ];
    expect(projectToolCalls(orphan)).toEqual([]);
  });

  test("an empty log projects to an empty list", () => {
    expect(projectToolCalls([])).toEqual([]);
  });

  test("does not alter project()'s output on the SAME event log (sibling, non-interfering)", () => {
    const events = toolCallRun();
    const p = project(events);
    // tool.* events carry no projection state — status/usage/checkpoints reflect only the
    // run/step/usage/checkpoint events also present in this fixture.
    expect(p.status).toBe("completed");
    expect(p.steps[0]?.status).toBe("ok");
  });
});

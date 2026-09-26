import { describe, expect, test } from "bun:test";
import { ValidationError, parseStrict } from "@caisson-sh/kernel";
import { DigestRef, TrajectoryEvent } from "./index.ts";

const UUID = "11111111-1111-4111-8111-111111111111";
const AT = "2026-07-16T10:00:00.000Z";
const DIGEST = "a".repeat(64);

/** A valid envelope for `kind` with the given payload. */
function evt(kind: string, seq: number, payload: unknown): unknown {
  return {
    eventId: UUID,
    runId: "run-1",
    seq,
    version: 1,
    occurredAt: AT,
    kind,
    payload,
  };
}

const samples: Array<[string, unknown]> = [
  [
    "run.started",
    { agentId: "agent-a", input: { digest: DIGEST, byteLength: 12 } },
  ],
  ["run.finished", { status: "completed" }],
  ["step.started", { stepId: "s1", depth: 0 }],
  [
    "step.started",
    { stepId: "s2", parentStepId: "s1", depth: 1, label: "subagent" },
  ],
  ["step.finished", { stepId: "s1", status: "ok" }],
  [
    "model.call",
    {
      provider: "anthropic",
      model: "opus",
      prompt: { digest: DIGEST, byteLength: 40 },
    },
  ],
  [
    "model.usage",
    {
      provider: "anthropic",
      model: "opus",
      inputTokens: 100,
      outputTokens: 20,
      credits: 3,
      billingStatus: "metered",
    },
  ],
  [
    "model.usage",
    {
      provider: "openai",
      model: "gpt-5.2-codex",
      inputTokens: 200,
      outputTokens: 40,
      credits: 7,
      billingStatus: "priced",
      priceBookVersion: "2026-06-01",
    },
  ],
  [
    "tool.proposed",
    {
      stepId: "s1",
      toolCallId: "t1",
      name: "grep",
      args: { digest: DIGEST, byteLength: 8 },
    },
  ],
  ["tool.approved", { toolCallId: "t1", actor: "operator" }],
  [
    "tool.denied",
    { toolCallId: "t2", actor: "policy", reason: "not allowlisted" },
  ],
  [
    "tool.result",
    { toolCallId: "t1", ok: true, result: { digest: DIGEST, byteLength: 64 } },
  ],
  ["checkpoint", { checkpointId: "c1", label: "after-tools" }],
];

describe("TrajectoryEvent — round-trip every kind", () => {
  for (const [kind, payload] of samples) {
    test(`${kind} parses and preserves its fields`, () => {
      const parsed = parseStrict(TrajectoryEvent, evt(kind, 0, payload));
      expect(parsed.kind as string).toBe(kind);
      expect(parsed.runId).toBe("run-1");
    });
  }

  test("model.usage defaults cachedInputTokens to 0", () => {
    const parsed = parseStrict(
      TrajectoryEvent,
      evt("model.usage", 0, {
        provider: "anthropic",
        model: "opus",
        inputTokens: 10,
        outputTokens: 2,
        credits: 0,
        billingStatus: "estimated",
      }),
    );
    if (parsed.kind !== "model.usage") throw new Error("kind narrowing failed");
    expect(parsed.payload.cachedInputTokens).toBe(0);
  });
});

describe("TrajectoryEvent — strict boundary rejects unknown fields", () => {
  test("an unknown envelope key is rejected", () => {
    const bad = {
      ...(evt("run.finished", 0, { status: "completed" }) as object),
      extra: 1,
    };
    expect(() => parseStrict(TrajectoryEvent, bad)).toThrow(ValidationError);
  });

  test("an unknown payload key is rejected", () => {
    expect(() =>
      parseStrict(
        TrajectoryEvent,
        evt("run.finished", 0, { status: "completed", note: "x" }),
      ),
    ).toThrow(ValidationError);
  });

  test("a non-integer credit unit is rejected (no floats, ADR-0007)", () => {
    expect(() =>
      parseStrict(
        TrajectoryEvent,
        evt("model.usage", 0, {
          provider: "anthropic",
          model: "opus",
          inputTokens: 10,
          outputTokens: 2,
          credits: 1.5,
          billingStatus: "metered",
        }),
      ),
    ).toThrow(ValidationError);
  });

  test("a non-hex digest is rejected (payload discipline)", () => {
    expect(() =>
      parseStrict(DigestRef, { digest: "nothex", byteLength: 4 }),
    ).toThrow(ValidationError);
  });
});

describe("model.usage — billing-grade credit invariant (ADR-0360 U-4)", () => {
  const usage = (over: Record<string, unknown>) =>
    evt("model.usage", 0, {
      provider: "anthropic",
      model: "opus",
      inputTokens: 10,
      outputTokens: 2,
      ...over,
    });

  test("estimated with nonzero credits is rejected", () => {
    expect(() =>
      parseStrict(
        TrajectoryEvent,
        usage({ credits: 1, billingStatus: "estimated" }),
      ),
    ).toThrow(ValidationError);
  });

  test("unsupported with nonzero credits is rejected", () => {
    expect(() =>
      parseStrict(
        TrajectoryEvent,
        usage({ credits: 1, billingStatus: "unsupported" }),
      ),
    ).toThrow(ValidationError);
  });

  test("priced with nonzero credits and a priceBookVersion parses", () => {
    const parsed = parseStrict(
      TrajectoryEvent,
      usage({
        credits: 4,
        billingStatus: "priced",
        priceBookVersion: "2026-06-01",
      }),
    );
    if (parsed.kind !== "model.usage") throw new Error("kind narrowing failed");
    expect(parsed.payload.priceBookVersion).toBe("2026-06-01");
  });

  test("priced with zero credits parses (band does not require spend)", () => {
    expect(() =>
      parseStrict(
        TrajectoryEvent,
        usage({ credits: 0, billingStatus: "priced" }),
      ),
    ).not.toThrow();
  });

  test("priceBookVersion on a non-priced band is rejected", () => {
    expect(() =>
      parseStrict(
        TrajectoryEvent,
        usage({
          credits: 3,
          billingStatus: "metered",
          priceBookVersion: "2026-06-01",
        }),
      ),
    ).toThrow(ValidationError);
  });
});

import { describe, expect, test } from "bun:test";
import { TrajectoryEvent, TRAJECTORY_VERSION } from "../browser.ts";
import { PRICE_BOOK_VERSION } from "@caisson-sh/ai-meter";
import { priceUsage } from "./normalize.ts";

/** A valid `model.usage` envelope in this package's additive convention. */
function usageEvent(payload: {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  credits?: number;
  billingStatus?: "metered" | "priced" | "estimated" | "unsupported";
}): TrajectoryEvent {
  return TrajectoryEvent.parse({
    eventId: crypto.randomUUID(),
    runId: "run-1",
    seq: 0,
    version: TRAJECTORY_VERSION,
    occurredAt: "2026-07-17T00:00:00.000Z",
    kind: "model.usage",
    payload: {
      provider: payload.provider,
      model: payload.model,
      inputTokens: payload.inputTokens,
      outputTokens: payload.outputTokens,
      cachedInputTokens: payload.cachedInputTokens ?? 0,
      credits: payload.credits ?? 0,
      billingStatus: payload.billingStatus ?? "estimated",
    },
  });
}

describe("priceUsage — alias hit upgrades estimated -> priced with integer, ceil-rounded credits", () => {
  test("known dated Claude id: exact hand-verified micro-USD/credit math", () => {
    // additive schema: inputTokens=400 (new), cachedInputTokens=800 -> ai-meter inclusive total 1200.
    // anthropic/claude-sonnet-4.5: input 3_000_000/MTok, cached 300_000/MTok, output 15_000_000/MTok.
    //   nonCached leg: ceil(400 * 3_000_000 / 1_000_000) = 1200 micro-USD
    //   cached leg:    ceil(800 *   300_000 / 1_000_000) =  240 micro-USD
    //   output leg:    ceil(340 *15_000_000 / 1_000_000) = 5100 micro-USD
    //   total = 6540 micro-USD -> credits = ceil(6540 / 1000) = 7 (exercises the ceil rounding: 6.54 -> 7)
    const [priced] = priceUsage([
      usageEvent({
        provider: "anthropic",
        model: "claude-sonnet-4-5-20250514",
        inputTokens: 400,
        cachedInputTokens: 800,
        outputTokens: 340,
      }),
    ]);
    if (priced?.kind !== "model.usage")
      throw new Error("expected a model.usage event");
    expect(priced.payload.billingStatus).toBe("priced");
    expect(priced.payload.credits).toBe(7);
    expect(Number.isInteger(priced.payload.credits)).toBe(true);
    expect(priced.payload.priceBookVersion).toBe(PRICE_BOOK_VERSION);
    // Everything else on the payload is untouched.
    expect(priced.payload.inputTokens).toBe(400);
    expect(priced.payload.cachedInputTokens).toBe(800);
    expect(priced.payload.outputTokens).toBe(340);
  });

  test("the priced event re-parses through TrajectoryEvent/parseStrict", () => {
    const [priced] = priceUsage([
      usageEvent({
        provider: "openai",
        model: "gpt-4o-mini-2024-07-18",
        inputTokens: 1000,
        outputTokens: 50,
      }),
    ]);
    expect(TrajectoryEvent.safeParse(priced).success).toBe(true);
  });
});

describe("priceUsage — passthrough, never a guess, never mutates input", () => {
  test("unknown model/alias miss stays estimated with credits 0, unchanged by reference", () => {
    const input = usageEvent({
      provider: "anthropic",
      model: "claude-opus-4-8", // no seeded alias
      inputTokens: 1200,
      cachedInputTokens: 800,
      outputTokens: 340,
    });
    const [result] = priceUsage([input]);
    expect(result).toBe(input); // same reference: proves no copy/mutation on a miss
    if (result?.kind !== "model.usage")
      throw new Error("expected a model.usage event");
    expect(result.payload.billingStatus).toBe("estimated");
    expect(result.payload.credits).toBe(0);
  });

  test("an already-metered event passes through unchanged", () => {
    const input = usageEvent({
      provider: "anthropic",
      model: "claude-sonnet-4-5-20250514",
      inputTokens: 100,
      outputTokens: 20,
      credits: 42,
      billingStatus: "metered",
    });
    const [result] = priceUsage([input]);
    expect(result).toBe(input);
  });

  test("an already-priced event passes through unchanged (idempotent)", () => {
    const input = usageEvent({
      provider: "anthropic",
      model: "claude-sonnet-4-5-20250514",
      inputTokens: 100,
      outputTokens: 20,
      credits: 5,
      billingStatus: "priced",
    });
    const [result] = priceUsage([input]);
    expect(result).toBe(input);
  });

  test("an unsupported event passes through unchanged, never priced even with a resolvable model", () => {
    const input = usageEvent({
      provider: "anthropic",
      model: "claude-sonnet-4-5-20250514",
      inputTokens: 0,
      outputTokens: 0,
      credits: 0,
      billingStatus: "unsupported",
    });
    const [result] = priceUsage([input]);
    expect(result).toBe(input);
  });

  test("a non-model.usage event passes through unchanged", () => {
    const runStarted = TrajectoryEvent.parse({
      eventId: crypto.randomUUID(),
      runId: "run-1",
      seq: 0,
      version: TRAJECTORY_VERSION,
      occurredAt: "2026-07-17T00:00:00.000Z",
      kind: "run.started",
      payload: { agentId: "agent-1" },
    });
    const [result] = priceUsage([runStarted]);
    expect(result).toBe(runStarted);
  });
});

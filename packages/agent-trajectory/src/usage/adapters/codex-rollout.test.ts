import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseCodexRollout } from "./codex-rollout.ts";

const fixture = (name: string): string =>
  readFileSync(
    fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)),
    "utf8",
  );

/** Deterministic ids/clock so events are stable under test. */
const opts = {
  runId: "run-1",
  eventId: () => "22222222-2222-4222-8222-222222222222",
  now: () => "2026-07-17T00:00:00.000Z",
};

describe("parseCodexRollout — bar 1: model latched, provider from session_meta, never guessed", () => {
  test("model latches from the nearest turn_context across a mid-session model switch", () => {
    const result = parseCodexRollout(fixture("basic.jsonl"), opts);
    expect(result.linesParsed).toBe(2);
    expect(result.linesSkipped).toBe(0);
    expect(result.unsupported).toBe(false);

    const [first, second] = result.events;
    if (first?.kind !== "model.usage" || second?.kind !== "model.usage") {
      throw new Error("expected two model.usage events");
    }
    expect(first.payload.model).toBe("gpt-5.6-sol");
    expect(second.payload.model).toBe("gpt-5.6-mini");
    expect(first.payload.provider).toBe("openai");
    expect(second.payload.provider).toBe("openai");
    expect(first.payload.billingStatus).toBe("estimated");
    expect(first.payload.credits).toBe(0);
  });

  test("a token_count event before model/provider are both latched is skipped, never hardcoded", () => {
    const result = parseCodexRollout(fixture("no-context.jsonl"), opts);
    // 3 token_count lines total; only the 3rd has both model (from line 2) and provider (from
    // line 4) latched. The first two are skipped, never attributed to a guessed model/provider.
    expect(result.linesParsed).toBe(1);
    expect(result.linesSkipped).toBe(2);
    expect(result.unsupported).toBe(false);

    const [only] = result.events;
    if (only?.kind !== "model.usage")
      throw new Error("expected a model.usage event");
    expect(only.payload.model).toBe("gpt-5.6-sol");
    expect(only.payload.provider).toBe("openai");
  });
});

describe("parseCodexRollout — bar 2: last_token_usage deltas, additive-convention, delta-consistency", () => {
  test("cached_input_tokens is subtracted out of input_tokens (additive convention)", () => {
    const [first, second] = parseCodexRollout(
      fixture("basic.jsonl"),
      opts,
    ).events;
    if (first?.kind !== "model.usage" || second?.kind !== "model.usage") {
      throw new Error("expected two model.usage events");
    }
    // last_token_usage turn 1: input 1000, cached 200 -> inputTokens = 800, cachedInputTokens = 200.
    expect(first.payload.inputTokens).toBe(800);
    expect(first.payload.cachedInputTokens).toBe(200);
    // last_token_usage turn 2 (the delta, NOT the 1600/350 cumulative counter): input 600, cached 150.
    expect(second.payload.inputTokens).toBe(450);
    expect(second.payload.cachedInputTokens).toBe(150);
  });

  test("summed emitted events reconcile against the session's final cumulative total_token_usage", () => {
    const events = parseCodexRollout(fixture("basic.jsonl"), opts).events;
    const totalInput = events.reduce(
      (sum, e) =>
        e.kind === "model.usage"
          ? sum + e.payload.inputTokens + e.payload.cachedInputTokens
          : sum,
      0,
    );
    const totalOutput = events.reduce(
      (sum, e) =>
        e.kind === "model.usage" ? sum + e.payload.outputTokens : sum,
      0,
    );
    // The fixture's final total_token_usage: input 1600, output 230 (see basic.jsonl line 5).
    expect(totalInput).toBe(1600);
    expect(totalOutput).toBe(230);
  });
});

describe("parseCodexRollout — bar 3: reasoning_output_tokens already folded into output_tokens", () => {
  test("outputTokens is the reported output_tokens, never output_tokens + reasoning_output_tokens", () => {
    const [first, second] = parseCodexRollout(
      fixture("basic.jsonl"),
      opts,
    ).events;
    if (first?.kind !== "model.usage" || second?.kind !== "model.usage") {
      throw new Error("expected two model.usage events");
    }
    // turn 1: output_tokens 150, reasoning_output_tokens 40 (already inside the 150) -> NOT 190.
    expect(first.payload.outputTokens).toBe(150);
    // turn 2: output_tokens 80, reasoning_output_tokens 20 (already inside the 80) -> NOT 100.
    expect(second.payload.outputTokens).toBe(80);
  });
});

describe("parseCodexRollout — bar 4: a token_count-free session yields zero events + unsupported", () => {
  test("no token_count event_msg anywhere -> zero events, unsupported true, no fake estimated event", () => {
    const result = parseCodexRollout(fixture("token-count-free.jsonl"), opts);
    expect(result.events).toEqual([]);
    expect(result.linesParsed).toBe(0);
    expect(result.linesSkipped).toBe(0); // structural noise (agent_message/response_item), not failures
    expect(result.unsupported).toBe(true);
  });
});

describe("parseCodexRollout — malformed lines are skipped, counted, never thrown", () => {
  test("invalid JSON and unusable token_count shapes are counted as skipped", () => {
    const result = parseCodexRollout(fixture("malformed.jsonl"), opts);
    // 1 real usage turn; a garbage JSON line + an empty-info token_count + a string-typed
    // input_tokens token_count are all skipped.
    expect(result.linesParsed).toBe(1);
    expect(result.linesSkipped).toBe(3);
    expect(result.unsupported).toBe(false);
  });

  test("empty input yields no events, no throw, and is not counted unsupported-worthy skips", () => {
    const result = parseCodexRollout("\n\n  \n", opts);
    expect(result.events).toEqual([]);
    expect(result.linesParsed).toBe(0);
    expect(result.linesSkipped).toBe(0);
    expect(result.unsupported).toBe(true);
  });
});

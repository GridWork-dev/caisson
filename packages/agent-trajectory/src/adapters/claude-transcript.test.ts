import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseClaudeTranscript } from "../index.ts";

const fixture = (name: string): string =>
  readFileSync(
    fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)),
    "utf8",
  );

/** Deterministic ids/clock so events are stable under test. */
const opts = {
  runId: "run-1",
  eventId: () => "11111111-1111-4111-8111-111111111111",
  now: () => "2026-07-16T00:00:00.000Z",
};

describe("parseClaudeTranscript — usage extraction", () => {
  test("every usage-bearing turn (main AND subagent) becomes one model.usage event", () => {
    const result = parseClaudeTranscript(fixture("subagent.jsonl"), opts);
    // 4 assistant usage turns (2 main + 2 subagent); the leading user line is skipped.
    expect(result.linesParsed).toBe(4);
    expect(result.linesSkipped).toBe(1);
    expect(result.events.map((e) => e.seq)).toEqual([0, 1, 2, 3]);
    for (const e of result.events) {
      expect(e.kind).toBe("model.usage");
      if (e.kind !== "model.usage") continue;
      expect(e.payload.billingStatus).toBe("estimated");
      expect(e.payload.credits).toBe(0); // estimated: not billing-grade
      expect(e.payload.provider).toBe("anthropic");
    }
  });

  test("real token counts + model id are carried through", () => {
    const [first] = parseClaudeTranscript(
      fixture("subagent.jsonl"),
      opts,
    ).events;
    if (first?.kind !== "model.usage")
      throw new Error("expected a model.usage event");
    expect(first.payload.model).toBe("claude-opus-4-8");
    expect(first.payload.inputTokens).toBe(1200);
    expect(first.payload.outputTokens).toBe(340);
    expect(first.payload.cachedInputTokens).toBe(800);
  });

  test("a subagent turn without a cache field defaults cachedInputTokens to 0", () => {
    const events = parseClaudeTranscript(
      fixture("subagent.jsonl"),
      opts,
    ).events;
    const subagentNoCache = events[2];
    if (subagentNoCache?.kind !== "model.usage")
      throw new Error("expected a model.usage event");
    expect(subagentNoCache.payload.cachedInputTokens).toBe(0);
  });
});

describe("parseClaudeTranscript — malformed lines are skipped, counted, never thrown", () => {
  test("invalid JSON and non-usage lines are counted as skipped", () => {
    const result = parseClaudeTranscript(fixture("malformed.jsonl"), opts);
    // 2 real usage turns; a garbage line + a no-usage assistant line + a summary line skipped.
    expect(result.linesParsed).toBe(2);
    expect(result.linesSkipped).toBe(3);
  });

  test("empty input yields no events and no throw", () => {
    const result = parseClaudeTranscript("\n\n  \n", opts);
    expect(result.events).toEqual([]);
    expect(result.linesParsed).toBe(0);
    expect(result.linesSkipped).toBe(0);
  });
});

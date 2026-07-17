// PLAN T2 (CAISSON-109) — the v7 seam spike. Test-only: proves four load-bearing behaviors of
// the pinned `ai@7.0.22` callback/loop seam BEFORE the CAISSON-111 loop slice builds on top of
// it. No production code changes; findings + verdict live in
// `outputs/specs/agent-runtime/SPIKE-v7-seam.md`. Deterministic throughout: every model is a
// `MockLanguageModelV4` (zero network), following the mock-model pattern already established in
// `src/gateway.test.ts` / `src/usage.test.ts` (same `sdkUsage` fixture shape, copied locally
// since it is a private test helper, not a package export).
import { describe, expect, test } from "bun:test";
import {
  generateText,
  hasToolCall,
  stepCountIs,
  tool,
  type ModelMessage,
  type StopCondition,
} from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type {
  LanguageModelV4CallOptions,
  LanguageModelV4FinishReason,
  LanguageModelV4Usage,
} from "@ai-sdk/provider";
import { z } from "zod";

/** Copied from `src/gateway.test.ts` (private helper, not exported by the package). */
function sdkUsage(
  inputTokens: number | undefined,
  outputTokens: number | undefined,
): LanguageModelV4Usage {
  return {
    inputTokens: {
      total: inputTokens,
      noCache: inputTokens === undefined ? undefined : inputTokens,
      cacheRead: inputTokens === undefined ? undefined : 0,
      cacheWrite: 0,
    },
    outputTokens: {
      total: outputTokens,
      text: outputTokens,
      reasoning: 0,
    },
  };
}

function textResult(text: string) {
  return {
    finishReason: {
      unified: "stop",
      raw: "stop",
    } as LanguageModelV4FinishReason,
    usage: sdkUsage(10, 20),
    content: [{ type: "text" as const, text }],
    warnings: [],
  };
}

function toolCallResult(toolCallId: string) {
  return {
    finishReason: {
      unified: "tool-calls",
      raw: "tool-calls",
    } as LanguageModelV4FinishReason,
    usage: sdkUsage(10, 5),
    content: [
      {
        type: "tool-call" as const,
        toolCallId,
        toolName: "ping",
        // V4 tool-call input is a JSON-stringified blob, not a live object — the SDK parses it
        // against the tool's `inputSchema` before invoking `execute`.
        input: JSON.stringify({ n: 1 }),
      },
    ],
    warnings: [],
  };
}

/** A trivial one-arg tool: echoes back a step counter. `execute` never fails in this spike. */
function pingTool() {
  return tool({
    description: "echoes n",
    inputSchema: z.object({ n: z.number() }),
    execute: async ({ n }: { n: number }) => ({ echoed: n }),
  });
}

describe("v7 seam spike (a): onStepEnd throw is swallowed", () => {
  test("a throwing onStepEnd does not reject generateText or alter its result", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => textResult("ok"),
    });
    let onStepEndCalls = 0;

    const result = await generateText({
      model,
      prompt: "hi",
      onStepEnd: () => {
        onStepEndCalls += 1;
        throw new Error("boom from onStepEnd");
      },
    });

    // The call completed normally — the thrown error never surfaced to the caller.
    expect(result.text).toBe("ok");
    expect(result.steps).toHaveLength(1);
    // The callback DID run (and threw) — this rules out "never invoked" as a false-positive.
    expect(onStepEndCalls).toBe(1);
  });
});

describe("v7 seam spike (b): prepareStep throw aborts the call", () => {
  test("a throwing prepareStep rejects generateText with that same error", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => textResult("ok"),
    });
    const boom = new Error("boom from prepareStep");

    await expect(
      generateText({
        model,
        prompt: "hi",
        prepareStep: () => {
          throw boom;
        },
      }),
    ).rejects.toBe(boom);
  });
});

describe("v7 seam spike (c): stopWhen bounds a multi-step tool loop", () => {
  test("a model that ALWAYS proposes a tool call is halted at exactly stepCountIs(3) steps", async () => {
    let calls = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        calls += 1;
        // Never emits a natural "stop" — without a bound this loop runs forever.
        return toolCallResult(`call-${calls}`);
      },
    });

    const result = await generateText({
      model,
      prompt: "loop forever",
      tools: { ping: pingTool() },
      stopWhen: stepCountIs(3),
    });

    expect(result.steps).toHaveLength(3);
    expect(calls).toBe(3);
    // Confirms the bound is enforced by stopWhen, not by the model naturally stopping.
    expect(result.finishReason).toBe("tool-calls");
  });

  test("hasToolCall stops the loop as soon as the named tool is invoked", async () => {
    let calls = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        calls += 1;
        return toolCallResult(`call-${calls}`);
      },
    });

    const stop: StopCondition<{ ping: ReturnType<typeof pingTool> }> =
      hasToolCall("ping");
    const result = await generateText({
      model,
      prompt: "call once",
      tools: { ping: pingTool() },
      stopWhen: stop,
    });

    // stopWhen is checked AFTER a step executes, so one tool-call step is still one step —
    // the bound stops growth, it does not pre-empt the step that satisfies it.
    expect(result.steps).toHaveLength(1);
  });
});

describe("v7 seam spike (d): an explicit generateText-loop can interpose reserve/settle", () => {
  test("a hand-rolled per-step loop wraps every step in reserve -> execute -> settle, in order", async () => {
    const ledger: string[] = [];
    let stepsDone = 0;

    async function reserve(step: number) {
      ledger.push(`reserve:${step}`);
    }
    async function settle(step: number, outputTokens: number | undefined) {
      ledger.push(`settle:${step}:${outputTokens ?? 0}`);
    }

    // A model that answers tool-calls twice, then stops naturally on the third call —
    // the harness drives ONE generateText call per step (stopWhen: stepCountIs(1)) so the
    // outer loop, not the SDK, owns interposing money-metering around each step.
    const model = new MockLanguageModelV4({
      doGenerate: async (options: LanguageModelV4CallOptions) => {
        void options;
        stepsDone += 1;
        return stepsDone <= 2
          ? toolCallResult(`call-${stepsDone}`)
          : textResult("done");
      },
    });

    const tools = { ping: pingTool() };
    const messages: ModelMessage[] = [{ role: "user", content: "start" }];
    let step = 0;
    let last:
      Awaited<ReturnType<typeof generateText<typeof tools>>> | undefined;
    const MAX_STEPS = 10; // safety bound for the spike harness itself, never hit in this test
    do {
      step += 1;
      await reserve(step);
      last = await generateText({
        model,
        messages,
        tools,
        stopWhen: stepCountIs(1),
      });
      await settle(step, last.usage.outputTokens);
      messages.push(...last.responseMessages);
    } while (last.finishReason === "tool-calls" && step < MAX_STEPS);

    expect(step).toBe(3);
    expect(last.text).toBe("done");
    expect(ledger).toEqual([
      "reserve:1",
      "settle:1:5",
      "reserve:2",
      "settle:2:5",
      "reserve:3",
      "settle:3:20",
    ]);
  });
});

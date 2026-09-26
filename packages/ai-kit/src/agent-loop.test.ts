// Exit-gate proof for the bounded tool loop (the agent-runtime loop slice, ADR-0360 U-1). Same deterministic
// harness as gateway.test.ts: PGlite + production withTenant + MockLanguageModelV4 (zero network),
// the fixed METER price book making the integer money math exact. Proves the spike-pattern-(d)
// contract: reserve-before-step / settle-after-step in the loop's own try/catch, fail-closed
// 402 + fail-closed REQUIRED trajectory appends, tool steps metered before execution, budget
// enforced caller-side, exactly-once settlement under a restart-shaped retry, and a projection
// whose metered totals equal the ledger's settled actuals.
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { newTestPg, type TestPg } from "@caisson-sh/testing";
import {
  CREDIT_EXPIRY_MIGRATION_SQL,
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
  GRANT_CONSUMPTION_MIGRATION_SQL,
  balance,
  grant,
} from "@caisson-sh/credits";
import {
  GuardrailError,
  InMemoryEventSink,
  asCredits,
  asMicroUsdPerCredit,
} from "@caisson-sh/kernel";
import {
  AI_METER_SCHEMA_SQL,
  DEFAULT_OUTPUT_TOKENS,
  SPEND_POLICY_TABLE,
  USAGE_EVENT_TABLE,
  type MeterConfig,
} from "@caisson-sh/ai-meter";
import { PROMPT_REGISTRY_SCHEMA_SQL } from "@caisson-sh/prompt-registry";
import {
  localModerator,
  type GuardPolicy,
  type GuardRuntime,
} from "@caisson-sh/guardrails";
import type { AiSettings } from "@caisson-sh/ai-config";
import { withTenant } from "@caisson-sh/tenancy-rls";
import { MockLanguageModelV4 } from "ai/test";
import type {
  LanguageModelV4CallOptions,
  LanguageModelV4FinishReason,
  LanguageModelV4Usage,
} from "@ai-sdk/provider";
import { z } from "zod";
import {
  createMemoryTrajectoryStore,
  project,
  type TrajectoryStore,
} from "@caisson-sh/agent-trajectory";
import { runToolLoop, type RunToolLoopOptions } from "./agent-loop.ts";

let tp: TestPg;
const A = "acct_loop_a";

// 1 input token = 1 micro-USD, output = 2 micro-USD, 100 micro-USD per credit (ceil).
const METER: MeterConfig = {
  priceBook: {
    "openai/model": {
      inputPerMTok: 1_000_000,
      cachedInputPerMTok: 500_000,
      outputPerMTok: 2_000_000,
    },
  },
  conversion: { microUsdPerCredit: asMicroUsdPerCredit(100) },
  now: new Date("2026-06-27T12:00:00Z"),
};

const SETTINGS: AiSettings = {
  defaultLane: "default",
  lanes: {
    default: {
      provider: "openai",
      model: "model",
      apiKeyEnv: "OPENAI_API_KEY",
    },
  },
};

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
    outputTokens: { total: outputTokens, text: outputTokens, reasoning: 0 },
  };
}

function textResult(text: string) {
  return {
    finishReason: {
      unified: "stop",
      raw: "stop",
    } as LanguageModelV4FinishReason,
    usage: sdkUsage(10, 20), // 10 + 40 = 50 micro-USD -> 1 credit actual
    content: [{ type: "text" as const, text }],
    warnings: [],
  };
}

function toolCallResult(toolCallId: string, toolName = "ping") {
  return {
    finishReason: {
      unified: "tool-calls",
      raw: "tool-calls",
    } as LanguageModelV4FinishReason,
    usage: sdkUsage(10, 5), // 10 + 10 = 20 micro-USD -> 1 credit actual (ceil)
    content: [
      {
        type: "tool-call" as const,
        toolCallId,
        toolName,
        input: JSON.stringify({ n: 1 }),
      },
    ],
    warnings: [],
  };
}

/** Model scripted per call index; also captures each call's prompt for threading assertions. */
function scriptedModel(
  script: Array<
    ReturnType<typeof textResult> | ReturnType<typeof toolCallResult>
  >,
) {
  const prompts: LanguageModelV4CallOptions["prompt"][] = [];
  let calls = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async (options: LanguageModelV4CallOptions) => {
      prompts.push(options.prompt);
      const result = script[Math.min(calls, script.length - 1)];
      calls += 1;
      if (result === undefined) throw new Error("script exhausted");
      return result;
    },
  });
  return { model, prompts, calls: () => calls };
}

function sinkRuntime(): GuardRuntime {
  return { tenantId: A, sink: new InMemoryEventSink() };
}

const cleanPolicy = (over: Partial<GuardPolicy> = {}): GuardPolicy => ({
  policyName: "default",
  moderator: localModerator([]),
  ...over,
});

const pingTools = (execute?: (input: unknown) => Promise<unknown>) => ({
  ping: {
    description: "echoes n",
    inputSchema: z.object({ n: z.number() }),
    execute: execute ?? (async (input: unknown) => ({ echoed: input })),
  },
});

function loopOpts(
  model: MockLanguageModelV4,
  store: TrajectoryStore,
  over: Partial<RunToolLoopOptions> = {},
): RunToolLoopOptions {
  return {
    tx: tp.pg,
    accountId: A,
    settings: SETTINGS,
    resolveModel: () => model,
    guard: { policy: cleanPolicy(), runtime: sinkRuntime() },
    meter: METER,
    lane: "default",
    agentId: "agent-test",
    prompt: "start",
    tools: pingTools(),
    maxSteps: 5,
    creditBudget: 100,
    store,
    maxOutputTokens: 50,
    ...over,
  };
}

async function bal(): Promise<number> {
  return withTenant(tp.pg, A, (t) => balance(t, A));
}

async function seed(amount: number): Promise<void> {
  await withTenant(tp.pg, A, (tx) =>
    grant(tx, {
      accountId: A,
      amount: asCredits(amount),
      eventType: "purchase",
      sourceEventId: "seed",
    }),
  );
}

beforeEach(async () => {
  if (tp === undefined) tp = await newTestPg();
  await tp.exec(
    [
      "prompt_alias",
      "prompt_version",
      USAGE_EVENT_TABLE,
      "tenant_spend_window",
      SPEND_POLICY_TABLE,
      "spend_breaker",
      "grant_consumption",
      "credit_expiry_notice",
      "credit_event",
      "credit_wallet",
    ]
      .map((t) => `DROP TABLE IF EXISTS ${t} CASCADE;`)
      .join("\n"),
  );
  await tp.exec(CREDIT_SCHEMA_SQL);
  await tp.exec(CREDIT_ROUNDING_MIGRATION_SQL);
  await tp.exec(CREDIT_EXPIRY_MIGRATION_SQL);
  await tp.exec(GRANT_CONSUMPTION_MIGRATION_SQL);
  await tp.exec(AI_METER_SCHEMA_SQL);
  await tp.exec(PROMPT_REGISTRY_SCHEMA_SQL);
});

afterAll(async () => {
  await tp.close();
});

describe("runToolLoop — the governed per-step harness", () => {
  test("tool-call then stop: completed, exact event envelope, ledger-equal projection", async () => {
    await seed(100);
    const { model, prompts } = scriptedModel([
      toolCallResult("call-1"),
      textResult("done"),
    ]);
    const store = createMemoryTrajectoryStore();
    const result = await runToolLoop(loopOpts(model, store));

    expect(result.status).toBe("completed");
    expect(result.text).toBe("done");
    expect(result.stepsUsed).toBe(2);
    expect(result.creditsSpent).toBe(2); // 1 credit per model step, tool step settles 0

    const events = await store.read(result.runId);
    expect(events.map((e) => e.kind)).toEqual([
      "run.started",
      "step.started",
      "model.call",
      "model.usage",
      "tool.proposed",
      "tool.result",
      "step.finished",
      "step.started",
      "model.call",
      "model.usage",
      "step.finished",
      "run.finished",
    ]);

    // The second model call saw the tool result (responseMessages + tool message threaded).
    const second = prompts[1];
    expect(JSON.stringify(second)).toContain("tool-result");

    // Projection banding equals the ledger's settled actuals. Wallet conservation is a
    // necessary consistency check (not a standalone exactly-once oracle — that proof is the
    // retry test below plus the meter's usage_event UNIQUE idempotency).
    const p = project(events);
    expect(p.status).toBe("completed");
    expect(p.usageTotals.metered.credits).toBe(result.creditsSpent);
    expect(await bal()).toBe(100 - result.creditsSpent);
  });

  // Proves MONEY idempotency by callId (fresh stores per attempt). A bare `runToolLoop()`
  // re-invocation against a SHARED durable store still collides at seq 0 by design — that is
  // not how S3 resumes a run. S3 (ADR-0360 U-3, `resumeToolLoop` + `approval.ts`) landed the
  // real mechanism: an approved parked run continues from its persisted `resumeSeq`, never from
  // seq 0 — see `approval.test.ts`'s "real process boundary" test for the resumed-run proof.
  test("restart-shaped retry with the same runId settles the METER exactly once (no double charge)", async () => {
    await seed(100);
    const runId = "run-retry";
    const mk = () =>
      scriptedModel([toolCallResult("call-1"), textResult("done")]).model;
    const first = await runToolLoop(
      loopOpts(mk(), createMemoryTrajectoryStore(), { runId }),
    );
    const afterFirst = await bal();
    const second = await runToolLoop(
      loopOpts(mk(), createMemoryTrajectoryStore(), { runId }),
    );
    expect(first.status).toBe("completed");
    expect(second.status).toBe("completed");
    // Same runId => same per-step callIds => reserve/reconcile replay idempotently.
    expect(await bal()).toBe(afterFirst);
  });

  test("never-stopping model halts at maxSteps with step-ceiling", async () => {
    await seed(100);
    let n = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        n += 1;
        return toolCallResult(`call-${String(n)}`);
      },
    });
    const store = createMemoryTrajectoryStore();
    const result = await runToolLoop(loopOpts(model, store, { maxSteps: 3 }));
    expect(result.status).toBe("failed");
    expect(result.failure?.code).toBe("step-ceiling");
    expect(result.stepsUsed).toBe(3);
    expect(n).toBe(3);
    const events = await store.read(result.runId);
    expect(events.at(-1)?.kind).toBe("run.finished");
  });

  test("budget exhaustion mid-run is a 402-shaped failure BEFORE the next reserve", async () => {
    await seed(100);
    let n = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        n += 1;
        return toolCallResult(`call-${String(n)}`);
      },
    });
    const store = createMemoryTrajectoryStore();
    // Step 1 estimate fits (≈2 credits); after settling 1 credit, step 2's estimate can no
    // longer fit a budget of 2 — the run fails before reserving step 2.
    const result = await runToolLoop(
      loopOpts(model, store, { creditBudget: 2 }),
    );
    expect(result.status).toBe("failed");
    expect(result.failure?.code).toBe("budget-exceeded");
    expect(n).toBe(1); // the model was never called for the rejected step
    expect(await bal()).toBe(100 - result.creditsSpent); // no reservation leaked
  });

  test("short wallet: reserve 402s fail-closed, the model is never called", async () => {
    // No seed — the wallet is empty.
    const { model, calls } = scriptedModel([textResult("never")]);
    const store = createMemoryTrajectoryStore();
    const result = await runToolLoop(loopOpts(model, store));
    expect(result.status).toBe("failed");
    expect(result.failure?.code).toBe("reserve-402");
    expect(calls()).toBe(0);
    expect(await bal()).toBe(0);
    const events = await store.read(result.runId);
    expect(events.at(-1)?.kind).toBe("run.finished");
    if (events.at(-1)?.kind === "run.finished") {
      expect(events.at(-1)?.payload).toMatchObject({ status: "failed" });
    }
  });

  test("a REQUIRED append failure prevents the step (fail-closed inversion)", async () => {
    await seed(100);
    const { model, calls } = scriptedModel([textResult("never")]);
    const inner = createMemoryTrajectoryStore();
    let appends = 0;
    const failing: TrajectoryStore = {
      async append(event) {
        appends += 1;
        if (appends === 2) throw new Error("store down"); // step.started
        return inner.append(event);
      },
      read: (runId) => inner.read(runId),
    };
    const result = await runToolLoop(loopOpts(model, failing));
    expect(result.status).toBe("failed");
    expect(result.failure?.code).toBe("trajectory-append");
    expect(calls()).toBe(0); // the step never ran
    expect(await bal()).toBe(100); // and never reserved
  });

  test("a model.call append failure cannot orphan a reservation (BL-01: append is pre-reserve)", async () => {
    await seed(100);
    const { model, calls } = scriptedModel([textResult("never")]);
    const inner = createMemoryTrajectoryStore();
    const failing: TrajectoryStore = {
      async append(event) {
        if (event.kind === "model.call") throw new Error("store down");
        return inner.append(event);
      },
      read: (runId) => inner.read(runId),
    };
    const result = await runToolLoop(loopOpts(model, failing));
    expect(result.status).toBe("failed");
    expect(result.failure?.code).toBe("trajectory-append");
    expect(calls()).toBe(0); // model never called
    expect(await bal()).toBe(100); // NOTHING debited — the append precedes the reserve
  });

  test("a model.usage append failure fails the run with money already consistent", async () => {
    await seed(100);
    const { model } = scriptedModel([textResult("done")]);
    const inner = createMemoryTrajectoryStore();
    const failing: TrajectoryStore = {
      async append(event) {
        if (event.kind === "model.usage") throw new Error("store down");
        return inner.append(event);
      },
      read: (runId) => inner.read(runId),
    };
    const result = await runToolLoop(loopOpts(model, failing));
    expect(result.status).toBe("failed");
    expect(result.failure?.code).toBe("trajectory-append");
    // The step settled before the failed append: wallet and reported spend agree — no orphan.
    expect(await bal()).toBe(100 - result.creditsSpent);
    expect(result.creditsSpent).toBe(1);
  });

  test("the provider call is ALWAYS output-bounded by the priced estimate (audit F1)", async () => {
    await seed(100);
    const captured: Array<number | undefined> = [];
    const model = new MockLanguageModelV4({
      doGenerate: async (options: LanguageModelV4CallOptions) => {
        captured.push(options.maxOutputTokens);
        return textResult("done");
      },
    });
    const store = createMemoryTrajectoryStore();
    // No maxOutputTokens supplied — the loop must still bound the call at the meter default
    // it priced the reservation with (an uncapped call would fail the budget ceiling open).
    const opts = loopOpts(model, store);
    const { maxOutputTokens: _drop, ...rest } = opts;
    const result = await runToolLoop(rest as RunToolLoopOptions);
    expect(result.status).toBe("completed");
    expect(captured).toEqual([DEFAULT_OUTPUT_TOKENS]);
  });

  test("a persistently-dead store still resolves a failed result (terminal append best-effort)", async () => {
    await seed(100);
    const { model } = scriptedModel([textResult("never")]);
    const dead: TrajectoryStore = {
      async append() {
        throw new Error("store down");
      },
      read: async () => [],
    };
    const result = await runToolLoop(loopOpts(model, dead));
    expect(result.status).toBe("failed");
    expect(result.failure?.code).toBe("trajectory-append");
    expect(await bal()).toBe(100);
  });

  test("provider failure refunds the reservation", async () => {
    await seed(100);
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("provider down");
      },
    });
    const store = createMemoryTrajectoryStore();
    const result = await runToolLoop(loopOpts(model, store));
    expect(result.status).toBe("failed");
    expect(result.failure?.code).toBe("provider");
    expect(await bal()).toBe(100); // full refund — a failed call never charges
  });

  test("tool step is metered before execution and its failure fails the run", async () => {
    await seed(100);
    const { model } = scriptedModel([toolCallResult("call-1")]);
    const store = createMemoryTrajectoryStore();
    const order: string[] = [];
    const result = await runToolLoop(
      loopOpts(model, store, {
        tools: {
          ping: {
            description: "echoes n",
            inputSchema: z.object({ n: z.number() }),
            execute: async () => {
              order.push("execute");
              throw new Error("tool exploded");
            },
          },
        },
      }),
    );
    expect(result.status).toBe("failed");
    expect(result.failure?.code).toBe("tool");
    expect(order).toEqual(["execute"]); // it ran (after its reservation), then failed
    const events = await store.read(result.runId);
    const toolResult = events.find((e) => e.kind === "tool.result");
    expect(toolResult?.payload).toMatchObject({ ok: false });
    // The tool step's meter legs left an audit row but moved no credits.
    expect(await bal()).toBe(100 - result.creditsSpent);
  });

  test("a model proposing an undeclared tool fails the run", async () => {
    await seed(100);
    const { model } = scriptedModel([toolCallResult("call-1", "nope")]);
    const store = createMemoryTrajectoryStore();
    const result = await runToolLoop(loopOpts(model, store));
    expect(result.status).toBe("failed");
    expect(result.failure?.code).toBe("tool");
  });

  test("output-guard block fails the run after settlement (spend already real)", async () => {
    await seed(100);
    const { model } = scriptedModel([textResult("contains banned word")]);
    const store = createMemoryTrajectoryStore();
    const result = await runToolLoop(
      loopOpts(model, store, {
        guard: {
          policy: cleanPolicy({ moderator: localModerator(["banned"]) }),
          runtime: sinkRuntime(),
        },
      }),
    );
    expect(result.status).toBe("failed");
    expect(result.failure?.code).toBe("guard");
    expect(result.creditsSpent).toBe(1); // the model step settled — tokens were consumed
  });

  test("input-guard block throws before any event or spend", async () => {
    await seed(100);
    const { model, calls } = scriptedModel([textResult("never")]);
    const store = createMemoryTrajectoryStore();
    await expect(
      runToolLoop(
        loopOpts(model, store, {
          prompt: "banned opening",
          guard: {
            policy: cleanPolicy({ moderator: localModerator(["banned"]) }),
            runtime: sinkRuntime(),
          },
        }),
      ),
    ).rejects.toBeInstanceOf(GuardrailError);
    expect(calls()).toBe(0);
    expect(await bal()).toBe(100);
  });

  test("maxSteps and creditBudget must be positive integers", async () => {
    const { model } = scriptedModel([textResult("x")]);
    const store = createMemoryTrajectoryStore();
    await expect(
      runToolLoop(loopOpts(model, store, { maxSteps: 0 })),
    ).rejects.toThrow(RangeError);
    await expect(
      runToolLoop(loopOpts(model, store, { creditBudget: 1.5 })),
    ).rejects.toThrow(RangeError);
  });
});

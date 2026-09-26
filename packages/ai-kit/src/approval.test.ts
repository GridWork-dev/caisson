// Exit-gate proof for the approval + durability seam (ADR-0360 U-2/U-3, S3). Two harnesses:
// in-memory (fast, exhaustive CAS/idempotency coverage) and PGlite (the REAL process-boundary
// proof — park via one set of store objects, approve + resume via completely FRESH ones
// constructed off a real `0001_trajectory_event.sql`/`0002_agent_run_state.sql` migration + the
// production `withTenant`, mirroring how a CLI verb and a resume worker are actually separate
// processes against the same durable state).
import {
  afterAll,
  beforeEach,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
// PGlite under CI runner load regularly crosses the 5s default; repo-wide standard treatment.
setDefaultTimeout(30_000);
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
  asCredits,
  asMicroUsdPerCredit,
  ConflictError,
  InMemoryEventSink,
} from "@caisson-sh/kernel";
import {
  AI_METER_SCHEMA_SQL,
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
import type { JobQueue } from "@caisson-sh/jobs";
import {
  DerivedKeyProvider,
  derivedContext,
  type FieldCryptoContext,
} from "@caisson-sh/field-crypto";
import { MockLanguageModelV4 } from "ai/test";
import type {
  LanguageModelV4FinishReason,
  LanguageModelV4Usage,
} from "@ai-sdk/provider";
import { z } from "zod";
import {
  createMemoryRunStateStore,
  createMemoryTrajectoryStore,
  createPgRunStateStore,
  createPgTrajectoryStore,
  project,
  type RunStateStore,
  type TrajectoryStore,
} from "@caisson-sh/agent-trajectory";
import {
  approveToolCall,
  denyToolCall,
  RESUME_TASK_NAME,
  type ApprovalDeps,
} from "./approval.ts";
import {
  resumeToolLoop,
  runToolLoop,
  type LoopTool,
  type RunToolLoopOptions,
} from "./agent-loop.ts";

let tp: TestPg;
const A = "acct_approval_a";

// ADR-0361: the encRef wrap of `parked_state` needs a `FieldCryptoContext` per store instance —
// mirrors `run-state.pg.integration.test.ts`'s `cryptoCtxFor`/`stateStore` helpers. A fixed
// `DerivedKeyProvider` derives the SAME key deterministically for "fresh" store objects across the
// real-process-boundary test below.
const KEY_PROVIDER = new DerivedKeyProvider(
  Buffer.alloc(32, 3),
  Buffer.alloc(32, 5),
);
const cryptoCtxFor = (accountId: string): FieldCryptoContext =>
  derivedContext(KEY_PROVIDER, accountId);
const stateStore = (
  accountId: string,
): ReturnType<typeof createPgRunStateStore> =>
  createPgRunStateStore(tp.pg, accountId, cryptoCtxFor(accountId));

const METER: MeterConfig = {
  priceBook: {
    "openai/model": {
      inputPerMTok: 1_000_000,
      cachedInputPerMTok: 500_000,
      outputPerMTok: 2_000_000,
    },
  },
  conversion: { microUsdPerCredit: asMicroUsdPerCredit(100) },
  now: new Date("2026-07-17T12:00:00Z"),
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
  inputTokens: number,
  outputTokens: number,
): LanguageModelV4Usage {
  return {
    inputTokens: {
      total: inputTokens,
      noCache: inputTokens,
      cacheRead: 0,
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
    usage: sdkUsage(10, 20),
    content: [{ type: "text" as const, text }],
    warnings: [],
  };
}

function toolCallResult(toolCallId: string, toolName = "danger") {
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
        toolName,
        input: JSON.stringify({ n: 1 }),
      },
    ],
    warnings: [],
  };
}

function scriptedModel(
  script: Array<
    ReturnType<typeof textResult> | ReturnType<typeof toolCallResult>
  >,
) {
  let calls = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      const result = script[Math.min(calls, script.length - 1)];
      calls += 1;
      if (result === undefined) throw new Error("script exhausted");
      return result;
    },
  });
  return { model, calls: () => calls };
}

function sinkRuntime(): GuardRuntime {
  return { tenantId: A, sink: new InMemoryEventSink() };
}
const cleanPolicy = (): GuardPolicy => ({
  policyName: "default",
  moderator: localModerator([]),
});

const gatedTools: Readonly<Record<string, LoopTool>> = {
  danger: {
    description: "a gated tool the model may propose",
    inputSchema: z.object({ n: z.number() }),
    execute: async (input: unknown) => ({ ran: input }),
    approvalRequired: true,
  },
};

/** Return type keeps `runState` REQUIRED (unlike `RunToolLoopOptions`'s optional slot) — every
 *  call site here always supplies one, and `resumeToolLoop` needs it non-optional at the type
 *  level (`exactOptionalPropertyTypes`); spreading a value into an optional slot keeps the
 *  property's TYPE optional even though it's always present at runtime. */
function loopOpts(
  model: MockLanguageModelV4,
  store: TrajectoryStore,
  runState: RunStateStore,
  over: Partial<RunToolLoopOptions> = {},
): Omit<RunToolLoopOptions, "runState"> & { runState: RunStateStore } {
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
    tools: gatedTools,
    maxSteps: 5,
    creditBudget: 100,
    store,
    runState,
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
      "trajectory_event",
      "agent_run_state",
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
  const m1 = await Bun.file(
    new URL(
      "../../agent-trajectory/src/migrations/0001_trajectory_event.sql",
      import.meta.url,
    ),
  ).text();
  const m2 = await Bun.file(
    new URL(
      "../../agent-trajectory/src/migrations/0002_agent_run_state.sql",
      import.meta.url,
    ),
  ).text();
  const m3 = await Bun.file(
    new URL(
      "../../agent-trajectory/src/migrations/0003_agent_run_state_parked_state_encrypted.sql",
      import.meta.url,
    ),
  ).text();
  await tp.exec(m1);
  await tp.exec(m2);
  await tp.exec(m3);
});

afterAll(async () => {
  await tp.close();
});

/** A capturing JobQueue double — records every enqueue without running anything (the resume
 *  worker in these tests is driven EXPLICITLY via `resumeToolLoop`, never auto-fired). */
function capturingJobs(): {
  jobs: JobQueue;
  enqueued: Array<{ name: string; payload: unknown; singletonKey?: string }>;
} {
  const enqueued: Array<{
    name: string;
    payload: unknown;
    singletonKey?: string;
  }> = [];
  return {
    enqueued,
    jobs: {
      async enqueue(name, payload, options) {
        enqueued.push({
          name,
          payload,
          ...(options?.singletonKey !== undefined
            ? { singletonKey: options.singletonKey }
            : {}),
        });
      },
    },
  };
}

describe("runToolLoop — parks on a gated tool (in-memory)", () => {
  test("a gated tool call parks instead of executing; the trajectory has tool.proposed but no tool.result", async () => {
    await seed(100);
    const { model } = scriptedModel([toolCallResult("call-1")]);
    const store = createMemoryTrajectoryStore();
    const runState = createMemoryRunStateStore();
    const result = await runToolLoop(loopOpts(model, store, runState));

    expect(result.status).toBe("parked");
    expect(result.toolCallId).toBe("call-1");

    const events = await store.read(result.runId);
    expect(events.map((e) => e.kind)).toEqual([
      "run.started",
      "step.started",
      "model.call",
      "model.usage",
      "tool.proposed",
    ]);
    // run.finished is NEVER appended for a park — the run is paused, not decided.
    expect(events.some((e) => e.kind === "run.finished")).toBe(false);

    const snap = await runState.read(result.runId);
    expect(snap).toMatchObject({
      status: "parked",
      pendingToolCallId: "call-1",
    });
  });

  test("a gated tool without a configured runState fails the run fail-closed", async () => {
    await seed(100);
    const { model } = scriptedModel([toolCallResult("call-1")]);
    const store = createMemoryTrajectoryStore();
    const { runState: _drop, ...withoutRunState } = loopOpts(
      model,
      store,
      createMemoryRunStateStore(),
    );
    const result = await runToolLoop(withoutRunState);
    expect(result.status).toBe("failed");
    expect(result.failure?.code).toBe("tool");
  });
});

describe("approveToolCall / denyToolCall — orchestration (in-memory)", () => {
  test("approve appends tool.approved once, enqueues the resume job, and is idempotent on retry", async () => {
    await seed(100);
    const { model } = scriptedModel([toolCallResult("call-1")]);
    const store = createMemoryTrajectoryStore();
    const runState = createMemoryRunStateStore();
    const parked = await runToolLoop(loopOpts(model, store, runState));
    expect(parked.status).toBe("parked");

    const { jobs, enqueued } = capturingJobs();
    const deps: ApprovalDeps = { store, runState, jobs };

    const first = await approveToolCall(
      deps,
      parked.runId,
      "call-1",
      "operator@example.com",
    );
    expect(first.status).toBe("running");
    const second = await approveToolCall(
      deps,
      parked.runId,
      "call-1",
      "operator@example.com",
    );
    expect(second.status).toBe("running");

    const events = await store.read(parked.runId);
    const approvals = events.filter((e) => e.kind === "tool.approved");
    expect(approvals).toHaveLength(1); // never double-appended
    expect(approvals[0]?.payload).toMatchObject({
      toolCallId: "call-1",
      actor: "operator@example.com",
    });

    // Both calls enqueued (idempotent by singletonKey at the driver level) — never zero.
    expect(enqueued.length).toBeGreaterThanOrEqual(1);
    expect(enqueued[0]).toMatchObject({
      name: RESUME_TASK_NAME,
      singletonKey: parked.runId,
    });
  });

  test("F2 self-heal: a crash-shaped retry (CAS committed, append missing) still ends with tool.approved present", async () => {
    await seed(100);
    const { model } = scriptedModel([toolCallResult("call-1")]);
    const store = createMemoryTrajectoryStore();
    const runState = createMemoryRunStateStore();
    const parked = await runToolLoop(loopOpts(model, store, runState));
    expect(parked.status).toBe("parked");

    // Simulate the crash: the run-state CAS commits (mirrors what approveToolCall's first line
    // does), but the process dies before the trajectory append runs.
    const direct = await runState.approve(parked.runId, "call-1", 1);
    expect(direct.wasNoop).toBe(false);
    expect(await store.read(parked.runId)).not.toContainEqual(
      expect.objectContaining({ kind: "tool.approved" }),
    );

    // The retry: a fresh approveToolCall call sees wasNoop=true (the CAS already committed) and
    // must self-heal the missing append rather than silently accepting "already decided".
    const { jobs, enqueued } = capturingJobs();
    const retried = await approveToolCall(
      { store, runState, jobs },
      parked.runId,
      "call-1",
      "operator@example.com",
    );
    expect(retried.status).toBe("running");

    const events = await store.read(parked.runId);
    const approvals = events.filter((e) => e.kind === "tool.approved");
    expect(approvals).toHaveLength(1);
    expect(approvals[0]?.payload).toMatchObject({
      toolCallId: "call-1",
      actor: "operator@example.com",
    });
    expect(enqueued).toHaveLength(1); // the wake signal still fires
  });

  test("approve requires a non-empty actor", async () => {
    const store = createMemoryTrajectoryStore();
    const runState = createMemoryRunStateStore();
    const { jobs } = capturingJobs();
    await expect(
      approveToolCall({ store, runState, jobs }, "run-x", "call-1", ""),
    ).rejects.toThrow();
  });

  test("approve on an unknown/mismatched toolCallId is rejected", async () => {
    await seed(100);
    const { model } = scriptedModel([toolCallResult("call-1")]);
    const store = createMemoryTrajectoryStore();
    const runState = createMemoryRunStateStore();
    const parked = await runToolLoop(loopOpts(model, store, runState));
    const { jobs } = capturingJobs();
    await expect(
      approveToolCall(
        { store, runState, jobs },
        parked.runId,
        "call-wrong",
        "op",
      ),
    ).rejects.toThrow(ConflictError);
    await expect(
      approveToolCall({ store, runState, jobs }, "unknown-run", "call-1", "op"),
    ).rejects.toThrow();
  });

  test("deny appends tool.denied + run.finished(failed) and finishes the run", async () => {
    await seed(100);
    const { model } = scriptedModel([toolCallResult("call-1")]);
    const store = createMemoryTrajectoryStore();
    const runState = createMemoryRunStateStore();
    const parked = await runToolLoop(loopOpts(model, store, runState));

    const { jobs, enqueued } = capturingJobs();
    const deps: ApprovalDeps = { store, runState, jobs };
    const result = await denyToolCall(
      deps,
      parked.runId,
      "call-1",
      "operator@example.com",
      "not safe",
    );
    expect(result.status).toBe("finished");
    expect(enqueued).toHaveLength(0); // a denied run never resumes

    const events = await store.read(parked.runId);
    expect(events.map((e) => e.kind).slice(-2)).toEqual([
      "tool.denied",
      "run.finished",
    ]);
    const denied = events.find((e) => e.kind === "tool.denied");
    expect(denied?.payload).toMatchObject({
      toolCallId: "call-1",
      actor: "operator@example.com",
      reason: "not safe",
    });
    const finished = events.find((e) => e.kind === "run.finished");
    expect(finished?.payload).toMatchObject({ status: "failed" });

    // Idempotent retry — never re-appends.
    const retry = await denyToolCall(
      deps,
      parked.runId,
      "call-1",
      "operator@example.com",
    );
    expect(retry.status).toBe("finished");
    const eventsAfter = await store.read(parked.runId);
    expect(eventsAfter).toHaveLength(events.length);
  });
});

describe("resumeToolLoop — continues a parked run (in-memory)", () => {
  test("approve then resume: the approved tool executes and the run completes", async () => {
    await seed(100);
    const { model } = scriptedModel([
      toolCallResult("call-1"),
      textResult("done"),
    ]);
    const store = createMemoryTrajectoryStore();
    const runState = createMemoryRunStateStore();
    const parked = await runToolLoop(loopOpts(model, store, runState));
    expect(parked.status).toBe("parked");

    const { jobs } = capturingJobs();
    await approveToolCall(
      { store, runState, jobs },
      parked.runId,
      "call-1",
      "op",
    );

    const resumed = await resumeToolLoop({
      ...loopOpts(model, store, runState),
      runId: parked.runId,
    });
    expect(resumed.status).toBe("completed");
    expect(resumed.text).toBe("done");

    const events = await store.read(parked.runId);
    expect(events.map((e) => e.kind)).toEqual([
      "run.started",
      "step.started",
      "model.call",
      "model.usage",
      "tool.proposed",
      "tool.approved",
      "tool.result",
      "step.finished",
      "step.started",
      "model.call",
      "model.usage",
      "step.finished",
      "run.finished",
    ]);
    const p = project(events);
    expect(p.status).toBe("completed");
    expect(await bal()).toBe(100 - resumed.creditsSpent);
  });

  test("two concurrent resumes of the SAME approval: exactly one executes the tool", async () => {
    await seed(100);
    const { model } = scriptedModel([
      toolCallResult("call-1"),
      textResult("done"),
    ]);
    const store = createMemoryTrajectoryStore();
    const runState = createMemoryRunStateStore();
    const parked = await runToolLoop(loopOpts(model, store, runState));
    const { jobs } = capturingJobs();
    await approveToolCall(
      { store, runState, jobs },
      parked.runId,
      "call-1",
      "op",
    );

    const opts = { ...loopOpts(model, store, runState), runId: parked.runId };
    const results = await Promise.allSettled([
      resumeToolLoop(opts),
      resumeToolLoop(opts),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    if (rejected[0]?.status === "rejected") {
      expect(rejected[0].reason).toBeInstanceOf(ConflictError);
    }
  });

  test("resume without an approval (still parked) is rejected fail-closed", async () => {
    await seed(100);
    const { model } = scriptedModel([toolCallResult("call-1")]);
    const store = createMemoryTrajectoryStore();
    const runState = createMemoryRunStateStore();
    const parked = await runToolLoop(loopOpts(model, store, runState));
    await expect(
      resumeToolLoop({
        ...loopOpts(model, store, runState),
        runId: parked.runId,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  test("resume after a deny is rejected fail-closed (never executes the denied tool)", async () => {
    await seed(100);
    const { model } = scriptedModel([toolCallResult("call-1")]);
    const store = createMemoryTrajectoryStore();
    const runState = createMemoryRunStateStore();
    const parked = await runToolLoop(loopOpts(model, store, runState));
    const { jobs } = capturingJobs();
    await denyToolCall({ store, runState, jobs }, parked.runId, "call-1", "op");
    await expect(
      resumeToolLoop({
        ...loopOpts(model, store, runState),
        runId: parked.runId,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  test("resume of an unknown runId is rejected fail-closed", async () => {
    await seed(100);
    const { model } = scriptedModel([textResult("never")]);
    const store = createMemoryTrajectoryStore();
    const runState = createMemoryRunStateStore();
    await expect(
      resumeToolLoop({
        ...loopOpts(model, store, runState),
        runId: "no-such-run",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("park/approve/resume across a REAL process boundary (PGlite, fresh store objects)", () => {
  test("park via one set of store objects; approve + resume via COMPLETELY FRESH ones", async () => {
    await seed(100);
    const { model } = scriptedModel([
      toolCallResult("call-1"),
      textResult("done"),
    ]);

    // "Process 1": park using a FRESH store pair (each opens its own short-lived withTenant
    // transaction per call — see store.pg.ts's file header for why a store must never hold one
    // transaction open across a run's whole life).
    const parked = await runToolLoop(
      loopOpts(model, createPgTrajectoryStore(tp.pg, A), stateStore(A)),
    );
    expect(parked.status).toBe("parked");
    expect(parked.toolCallId).toBe("call-1");

    // "Process 2" (the CLI verb, COMPLETELY FRESH store objects): approve.
    const { jobs, enqueued } = capturingJobs();
    await approveToolCall(
      {
        store: createPgTrajectoryStore(tp.pg, A),
        runState: stateStore(A),
        jobs,
      },
      parked.runId,
      "call-1",
      "operator@example.com",
    );
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]?.singletonKey).toBe(parked.runId);

    // "Process 3" (the resume worker, yet ANOTHER fresh set of store objects).
    const resumed = await resumeToolLoop({
      ...loopOpts(model, createPgTrajectoryStore(tp.pg, A), stateStore(A)),
      runId: parked.runId,
    });
    expect(resumed.status).toBe("completed");
    expect(resumed.text).toBe("done");

    // Ground truth read back with a FOURTH fresh store object.
    const events = await createPgTrajectoryStore(tp.pg, A).read(parked.runId);
    expect(events.map((e) => e.kind)).toEqual([
      "run.started",
      "step.started",
      "model.call",
      "model.usage",
      "tool.proposed",
      "tool.approved",
      "tool.result",
      "step.finished",
      "step.started",
      "model.call",
      "model.usage",
      "step.finished",
      "run.finished",
    ]);
    expect(await bal()).toBe(100 - resumed.creditsSpent);

    // WR-02 + RETENTION (finding 1): a successful terminal resume marks the run-state row
    // FINISHED (not left dangling at "running" forever) and clears parked_state — the plaintext
    // conversation snapshot has no further use once the run is done.
    const rows = await tp.query<{ status: string; parked_state: unknown }>(
      `SELECT status, parked_state FROM agent_run_state WHERE run_id = $1`,
      [parked.runId],
    );
    expect(rows[0]?.status).toBe("finished");
    expect(rows[0]?.parked_state).toBeNull();
  });
});

// The parent-SPEC demo (the agent-runtime exposure + publish slice — the SPEC's exit gate): one
// deterministic proof driving start -> park -> approve -> resume -> finish across BOTH the CLI and
// MCP surfaces against the REAL PG stores (PGlite, mock model, zero network).
//
//   start   -> `caisson run start`'s thin MCP client (`@caisson/cli`'s `runStartClient`) calls the
//              REAL `run_start` MCP tool (`@caisson/mcp-server`'s `createStdioMcpServer`), which
//              invokes THIS package's
//              `buildRunTools` -> `runToolLoop` — a gated tool call parks the run.
//   approve -> `caisson run approve`'s direct-DB surface (`@caisson/cli`'s `approveRun`, raw SQL, no
//              MCP round-trip, S3's locked transport decision) — proves the MCP-started run and the
//              CLI-approved run agree on the SAME `agent_run_state`/`trajectory_event` rows.
//   resume  -> driven directly via `resumeToolLoop` (the loop-internal seam a real job worker calls;
//              this slice does not add a new "resume" surface — S3 already locked the enqueue-is-
//              the-wake-signal design) — completes the run.
//   status  -> BOTH `run_status` (MCP, the rich `project()` view) and `caisson run status` (CLI,
//              the hand-rolled trajectory summary) agree the run finished, never surfacing
//              `parked_state` on either surface (ADR-0361).
//
// `@caisson/cli` and `@caisson/mcp-server` are devDependencies ONLY (never runtime — ai-kit's own
// manifest.ts dependency list is untouched by this file), mirroring the precedent `@caisson/cli`'s
// OWN test suite already sets for a one-directional test-only cross-package import (its
// `run.test.ts` imports `@caisson/agent-trajectory`'s real Zod schema as a devDependency shape-
// parity check — see that file's header).
import {
  afterAll,
  beforeEach,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
setDefaultTimeout(30_000);
import { newTestPg, type TestPg } from "@caisson/testing";
import {
  CREDIT_EXPIRY_MIGRATION_SQL,
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
  GRANT_CONSUMPTION_MIGRATION_SQL,
  balance,
  grant,
} from "@caisson/credits";
import {
  InMemoryEventSink,
  asCredits,
  asMicroUsdPerCredit,
} from "@caisson/kernel";
import {
  AI_METER_SCHEMA_SQL,
  SPEND_POLICY_TABLE,
  USAGE_EVENT_TABLE,
  type MeterConfig,
} from "@caisson/ai-meter";
import { PROMPT_REGISTRY_SCHEMA_SQL } from "@caisson/prompt-registry";
import {
  localModerator,
  type GuardPolicy,
  type GuardRuntime,
} from "@caisson/guardrails";
import type { AiSettings } from "@caisson/ai-config";
import { withTenant } from "@caisson/tenancy-rls";
import {
  DerivedKeyProvider,
  derivedContext,
  withFieldCryptoContext,
} from "@caisson/field-crypto";
import {
  createPgRunStateStore,
  createPgTrajectoryStore,
} from "@caisson/agent-trajectory";
import { MockLanguageModelV4 } from "ai/test";
import type {
  LanguageModelV4FinishReason,
  LanguageModelV4Usage,
} from "@ai-sdk/provider";
import { z } from "zod";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { loadRegistryIndex } from "@caisson/registry-schema";
import {
  createStdioMcpServer,
  type McpServerOptions,
} from "@caisson/mcp-server";
import {
  approveRun,
  readRunStatus,
  runStartClient,
  type RunServiceDeps,
} from "@caisson/cli";
import { resumeToolLoop, type LoopTool } from "./agent-loop.ts";
import { buildRunTools } from "./mcp-run-tools.ts";

let tp: TestPg;
const A = "acct_demo_a";
const TOKEN = "tok_agent_runtime_demo_".padEnd(40, "0");
const INDEX = loadRegistryIndex({ schemaVersion: 1, modules: [] });

const KEY_PROVIDER = new DerivedKeyProvider(
  Buffer.alloc(32, 11),
  Buffer.alloc(32, 13),
);

const METER: MeterConfig = {
  priceBook: {
    "openai/model": {
      inputPerMTok: 1_000_000,
      cachedInputPerMTok: 500_000,
      outputPerMTok: 2_000_000,
    },
  },
  conversion: { microUsdPerCredit: asMicroUsdPerCredit(100) },
  now: new Date("2026-07-18T12:00:00Z"),
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
        toolName: "book_flight",
        input: JSON.stringify({ destination: "SFO" }),
      },
    ],
    warnings: [],
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

function sinkRuntime(): GuardRuntime {
  return { tenantId: A, sink: new InMemoryEventSink() };
}
const cleanPolicy = (): GuardPolicy => ({
  policyName: "default",
  moderator: localModerator([]),
});

const gatedTools: Readonly<Record<string, LoopTool>> = {
  book_flight: {
    description: "book a flight — requires operator approval",
    inputSchema: z.object({ destination: z.string() }),
    execute: async (input: unknown) => ({ booked: input }),
    approvalRequired: true,
  },
};

function capturingJobs(): {
  jobs: RunServiceDeps["jobs"];
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

/** Call `run_status` over a FRESH stdio server + in-memory transport pair built from the SAME `mcp`
 *  options (mirrors a real MCP client opening a new stdio connection per invocation — an SDK
 *  `Server` is connect-once, so a fresh server per call is required, not a reconnect). Mirrors
 *  `doctor.ts`'s `runDoctorClient` shape: the caller races `server.connect` against this function. */
async function callRunStatus(
  mcpOptions: McpServerOptions,
  runId: string,
): Promise<{ runState?: { status: string }; projection?: { status: string } }> {
  const server: Server = createStdioMcpServer({
    mcp: mcpOptions,
    bearer: TOKEN,
  });
  const [serverTransport, clientTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "demo-status-client", version: "1.0.0" });
  const [, callResult] = await Promise.all([
    server.connect(serverTransport),
    (async () => {
      await client.connect(clientTransport);
      try {
        return await client.callTool({
          name: "run_status",
          arguments: { runId },
        });
      } finally {
        await client.close();
      }
    })(),
  ]);
  const content =
    (callResult as { content?: { type: string; text: string }[] }).content ??
    [];
  return JSON.parse(content[0]?.text ?? "{}") as {
    runState?: { status: string };
    projection?: { status: string };
  };
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

describe("parent-SPEC demo — start/park/approve/resume/finish across the CLI + MCP surfaces", () => {
  test("a governed run parks on a gated tool, is approved via the CLI, resumed, and finishes clean", async () => {
    await seed(100);
    let calls = 0;
    const script = [toolCallResult("call-1"), textResult("flight booked")];
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        const result = script[Math.min(calls, script.length - 1)];
        calls += 1;
        if (result === undefined) throw new Error("script exhausted");
        return result;
      },
    });

    const runTools = buildRunTools({
      tx: tp.pg,
      settings: SETTINGS,
      resolveModel: () => model,
      guard: { policy: cleanPolicy(), runtime: sinkRuntime() },
      meter: METER,
      lane: "default",
      agentId: "demo-agent",
      tools: gatedTools,
      maxSteps: 5,
      creditBudget: 100,
      maxOutputTokens: 50,
      fieldCryptoContext: async (accountId, fn) => {
        const ctx = derivedContext(KEY_PROVIDER, accountId);
        return withTenant(tp.pg, accountId, (tx) =>
          withFieldCryptoContext(ctx, () => fn(tx, ctx)),
        );
      },
    });

    const mcpOptions: McpServerOptions = {
      tokens: [{ token: TOKEN, accountId: A }],
      index: INDEX,
      onGenerate: async () => ({ generationId: "g" }),
      runTools,
    };

    // --- start: caisson run start (thin MCP client) -------------------------------------------
    const startServer: Server = createStdioMcpServer({
      mcp: mcpOptions,
      bearer: TOKEN,
    });
    const [serverTransport, clientTransport] =
      InMemoryTransport.createLinkedPair();
    const [, startResult] = await Promise.all([
      startServer.connect(serverTransport),
      runStartClient({
        transport: clientTransport,
        prompt: "book me a flight to SFO",
      }),
    ]);
    const parked = startResult as {
      runId: string;
      status: string;
      toolCallId?: string;
    };
    expect(parked.status).toBe("parked");
    expect(parked.toolCallId).toBe("call-1");
    const runId = parked.runId;

    // ADR-0361 proof: the raw row is never plaintext, even mid-flight.
    const rawParked = await tp.query<{ parked_state: unknown }>(
      `SELECT parked_state FROM agent_run_state WHERE run_id = $1`,
      [runId],
    );
    expect(typeof rawParked[0]?.parked_state).toBe("string");
    expect(rawParked[0]?.parked_state as string).not.toContain("book_flight");
    expect(rawParked[0]?.parked_state as string).not.toContain("SFO");

    // --- approve: caisson run approve (direct DB, no MCP round-trip, S3 lock) -----------------
    const { jobs, enqueued } = capturingJobs();
    const cliDeps: RunServiceDeps = { tx: tp.pg, accountId: A, jobs };
    const approved = await approveRun(
      cliDeps,
      runId,
      "call-1",
      "operator@example.com",
    );
    expect(approved.status).toBe("running");
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]).toMatchObject({
      name: "agent-run.resume",
      singletonKey: runId,
    });

    // --- resume: the loop-internal seam a real job worker calls (S3's enqueue-is-the-wake-signal
    //     design; this slice adds no new "resume" surface) ------------------------------------
    const resumed = await resumeToolLoop({
      tx: tp.pg,
      accountId: A,
      settings: SETTINGS,
      resolveModel: () => model,
      guard: { policy: cleanPolicy(), runtime: sinkRuntime() },
      meter: METER,
      lane: "default",
      agentId: "demo-agent",
      tools: gatedTools,
      maxSteps: 5,
      creditBudget: 100,
      maxOutputTokens: 50,
      store: createPgTrajectoryStore(tp.pg, A),
      runState: createPgRunStateStore(
        tp.pg,
        A,
        derivedContext(KEY_PROVIDER, A),
      ),
      runId,
    });
    expect(resumed.status).toBe("completed");
    expect(resumed.text).toBe("flight booked");
    expect(await bal()).toBe(100 - resumed.creditsSpent);

    // --- status: both surfaces agree the run finished, never leaking parked_state -------------
    const mcpStatus = await callRunStatus(mcpOptions, runId);
    expect(mcpStatus.runState?.status).toBe("finished");
    expect(mcpStatus.projection?.status).toBe("completed");
    expect(JSON.stringify(mcpStatus)).not.toContain("book_flight");

    const cliStatus = await readRunStatus(cliDeps, runId);
    expect(cliStatus?.status).toBe("finished");
    expect(cliStatus?.trajectory.status).toBe("completed");
    expect(JSON.stringify(cliStatus)).not.toContain("book_flight");

    // The row itself, ground truth: finished + parked_state cleared (S3 retention, unaffected by
    // the encRef wrap — see run-state.pg.ts's finish()).
    const finalRow = await tp.query<{ status: string; parked_state: unknown }>(
      `SELECT status, parked_state FROM agent_run_state WHERE run_id = $1`,
      [runId],
    );
    expect(finalRow[0]?.status).toBe("finished");
    expect(finalRow[0]?.parked_state).toBeNull();
  });
});

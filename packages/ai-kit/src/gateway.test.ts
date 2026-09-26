// Exit-gate proof for the metered inference gateway (ADR-0059). PGlite + the production
// `withTenant` shape + a mock `LanguageModelV4` (zero network): a metered `infer()` reserves BEFORE
// the provider call, reconciles to actual, fail-closed 402s on a short wallet / open breaker without
// ever calling the model, blocks a guardrailed input with a 422 (no spend), restores tokenized PII on
// the output while the model only ever sees redacted text, resolves a prompt by `name@version`, and
// runs over a `createProviderRegistry` resolver. The live provider transport stays un-exercised.
//
// The `inferStream` block below is the streaming counterpart: same fixtures, a mock `doStream`
// instead of `doGenerate`, proving the reconcile-on-abandonment design (a normal drain trues up to
// the provider's ACTUAL usage; an early-stopped/aborted stream still reconciles, to an ESTIMATE,
// never leaking the up-front reservation).
import { randomUUID } from "node:crypto";
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
  InsufficientCreditsError,
  asCredits,
  asMicroUsdPerCredit,
} from "@caisson-sh/kernel";
import {
  AI_METER_SCHEMA_SQL,
  SPEND_POLICY_TABLE,
  SpendCapError,
  USAGE_EVENT_TABLE,
  reconcile,
  type MeterConfig,
} from "@caisson-sh/ai-meter";
import {
  PROMPT_REGISTRY_SCHEMA_SQL,
  registerPrompt,
} from "@caisson-sh/prompt-registry";
import {
  localModerator,
  type GuardPolicy,
  type GuardRuntime,
} from "@caisson-sh/guardrails";
import { DerivedKeyProvider, derivedContext } from "@caisson-sh/field-crypto";
import type { AiSettings } from "@caisson-sh/ai-config";
import { withTenant } from "@caisson-sh/tenancy-rls";
import { simulateReadableStream } from "ai";
import type { LanguageModelMiddleware } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type {
  LanguageModelV4,
  LanguageModelV4FinishReason,
  LanguageModelV4StreamPart,
  LanguageModelV4Usage,
  ProviderV4,
} from "@ai-sdk/provider";
import {
  buildRegistryResolver,
  infer,
  inferStream,
  OrphanedReservationError,
  type InferOptions,
  type InferStreamOptions,
  type TrajectoryRecorder,
} from "./gateway.ts";
import {
  createMemoryTrajectoryStore,
  TRAJECTORY_VERSION,
  type TrajectoryEvent,
} from "@caisson-sh/agent-trajectory";

let tp: TestPg;
const A = "acct_kit_a";

// A fixed price book + denomination + clock makes the integer money math deterministic. 1 input
// token = $1/MTok, output 2×, 1 credit = 100 micro-USD; provider/model = "openai/model".
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

// One output token costs 2,000,000,000 micro-USD (still a PostgreSQL integer); two overflow it.
// A 2,000,000,000 micro-USD denomination keeps the corresponding credit count small and valid.
const LEDGER_EDGE_METER: MeterConfig = {
  priceBook: {
    "openai/model": {
      inputPerMTok: 0,
      cachedInputPerMTok: 0,
      outputPerMTok: 2_000_000_000_000_000,
    },
  },
  conversion: { microUsdPerCredit: asMicroUsdPerCredit(2_000_000_000) },
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
    // A per-tenant BYOK lane (ADR-0182) — same price key, but a metered action debits $0.
    byok: {
      provider: "openai",
      model: "model",
      keySource: "tenant",
    },
  },
};

function sdkUsage(
  inputTokens: number | undefined,
  outputTokens: number | undefined,
  cachedInputTokens = 0,
): LanguageModelV4Usage {
  return {
    inputTokens: {
      total: inputTokens,
      noCache:
        inputTokens === undefined
          ? undefined
          : Math.max(0, inputTokens - cachedInputTokens),
      cacheRead: inputTokens === undefined ? undefined : cachedInputTokens,
      cacheWrite: 0,
    },
    outputTokens: {
      total: outputTokens,
      text: outputTokens,
      reasoning: 0,
    },
  };
}

/** A mock model with usage 10 in / 20 out → 50 micro → 1 credit actual. Echoes a fixed reply. */
function mockModel(text = "ok"): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      finishReason: { unified: "stop", raw: "stop" },
      usage: sdkUsage(10, 20),
      content: [{ type: "text", text }],
      warnings: [],
    }),
  });
}

function mockModelWithUsage(
  text: string,
  inputTokens: number,
  outputTokens: number,
): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      finishReason: { unified: "stop", raw: "stop" },
      usage: sdkUsage(inputTokens, outputTokens),
      content: [{ type: "text", text }],
      warnings: [],
    }),
  });
}

/** A mock model that completes successfully but reports NO usage (both counts undefined). */
function mockModelNoUsage(text = "ok"): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      finishReason: { unified: "stop", raw: "stop" },
      usage: sdkUsage(undefined, undefined),
      content: [{ type: "text", text }],
      warnings: [],
    }),
  });
}

/**
 * A mock model that STREAMS `chunks` as separate `text-delta` parts, then a `finish` part carrying
 * `usage` — the low-level `LanguageModelV4StreamPart` shape `doStream` returns (note: `delta`, not
 * `text` — that field only exists on the higher-level `streamText().stream` parts). A
 * `chunkDelayInMs` lets a test deterministically stop draining before `finish` arrives.
 */
function mockStreamModel(
  chunks: string[],
  usage: { inputTokens: number; outputTokens: number; totalTokens: number },
  chunkDelayInMs: number | null = null,
  finishReason: LanguageModelV4FinishReason["unified"] = "stop",
): MockLanguageModelV4 {
  const parts: LanguageModelV4StreamPart[] = [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "1" },
    ...chunks.map((delta): LanguageModelV4StreamPart => ({
      type: "text-delta",
      id: "1",
      delta,
    })),
    { type: "text-end", id: "1" },
    {
      type: "finish",
      finishReason: { unified: finishReason, raw: finishReason },
      usage: sdkUsage(usage.inputTokens, usage.outputTokens),
    },
  ];
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({ chunks: parts, chunkDelayInMs }),
    }),
  });
}

/** A stream that finishes normally but reports NO usage — streaming twin of `mockModelNoUsage`. */
function mockStreamModelNoUsage(chunks: string[]): MockLanguageModelV4 {
  const parts: LanguageModelV4StreamPart[] = [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "1" },
    ...chunks.map((delta): LanguageModelV4StreamPart => ({
      type: "text-delta",
      id: "1",
      delta,
    })),
    { type: "text-end", id: "1" },
    {
      type: "finish",
      finishReason: { unified: "stop", raw: "stop" },
      usage: sdkUsage(undefined, undefined),
    },
  ];
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({ chunks: parts }),
    }),
  });
}

/** A stream that yields `chunks` then an `error` part — never reaches `finish`. */
function mockStreamModelError(
  chunks: string[],
  error: unknown,
): MockLanguageModelV4 {
  const parts: LanguageModelV4StreamPart[] = [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "1" },
    ...chunks.map((delta): LanguageModelV4StreamPart => ({
      type: "text-delta",
      id: "1",
      delta,
    })),
    { type: "error", error },
  ];
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({ chunks: parts }),
    }),
  });
}

function mockStreamModelReject(error: unknown): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doStream: async () => {
      throw error;
    },
  });
}

function sink(): InMemoryEventSink {
  return new InMemoryEventSink();
}

function runtime(s: InMemoryEventSink): GuardRuntime {
  return { tenantId: A, sink: s };
}

const cleanPolicy = (over: Partial<GuardPolicy> = {}): GuardPolicy => ({
  policyName: "default",
  moderator: localModerator([]),
  ...over,
});

function baseOpts(
  model: LanguageModelV4,
  policy: GuardPolicy,
  s: InMemoryEventSink,
  // `Partial<InferStreamOptions>` (a superset of InferOptions — adds only `abortSignal`) so the
  // same builder serves both infer() and inferStream() call sites.
  over: Partial<InferStreamOptions> = {},
): InferOptions {
  return {
    tx: tp.pg,
    accountId: A,
    settings: SETTINGS,
    resolveModel: () => model,
    guard: { policy, runtime: runtime(s) },
    meter: METER,
    maxOutputTokens: 50,
    ...over,
  };
}

async function settlesWithin<T>(
  promise: Promise<T>,
  timeoutMs = 1_000,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`stream settlement exceeded ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

async function freshSchema(): Promise<void> {
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

async function registerGreet(): Promise<void> {
  await withTenant(tp.pg, A, (tx) =>
    registerPrompt(tx, {
      accountId: A,
      name: "greet",
      messages: [{ role: "user", content: "Hi {{name}}!" }],
      varSpec: { name: "string" },
    }),
  );
}

beforeEach(async () => {
  if (!tp) tp = await newTestPg();
  await freshSchema();
});

afterAll(async () => {
  await tp.close();
});

describe("happy path — resolve → reserve → call → reconcile", () => {
  test("a prompt resolves by name@version, the call meters end-to-end, balance trues to actual", async () => {
    await seed(1000);
    await registerGreet();
    const s = sink();
    const model = mockModel("Hi world!");

    const res = await infer(
      "default",
      { promptRef: "greet@1", vars: { name: "world" } },
      baseOpts(model, cleanPolicy(), s),
    );

    expect(res.text).toBe("Hi world!");
    expect(res.promptVersionId).not.toBeNull();
    expect(res.reserved.reservedCredits).toBeGreaterThan(0);
    expect(res.reconciled.actualCredits).toBe(1); // 10 in + 20 out → 50 micro → 1 credit
    expect(res.usage).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      cachedInputTokens: 0,
    });
    expect(model.doGenerateCalls).toHaveLength(1);

    // The wallet settled to the ACTUAL charge, not the (larger) reservation.
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(999);
    const rows = await tp.query<{ credits: number }>(
      `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.credits).toBe(1);
  });

  test("the gateway also accepts raw messages (no registry) — promptVersionId is null", async () => {
    await seed(1000);
    const s = sink();
    const model = mockModel("pong");

    const res = await infer(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), s),
    );

    expect(res.text).toBe("pong");
    expect(res.promptVersionId).toBeNull();
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  test("trusted registry system messages retain their ordered v7 prompt role", async () => {
    await seed(1000);
    await withTenant(tp.pg, A, (tx) =>
      registerPrompt(tx, {
        accountId: A,
        name: "instructed",
        messages: [
          { role: "system", content: "Answer concisely." },
          { role: "user", content: "Hello" },
        ],
        varSpec: {},
      }),
    );
    const model = mockModel("Hello!");

    const result = await infer(
      "default",
      { promptRef: "instructed@1" },
      baseOpts(model, cleanPolicy(), sink()),
    );

    expect(result.text).toBe("Hello!");
    expect(
      model.doGenerateCalls[0]?.prompt.map((message) => message.role),
    ).toEqual(["system", "user"]);
  });

  test("raw caller system messages preserve their position in the pre-v7 public prompt contract", async () => {
    await seed(1000);
    const model = mockModel("Hello!");

    const result = await infer(
      "default",
      {
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "How can I help?" },
          { role: "system", content: "Answer concisely from here." },
          { role: "user", content: "Summarize that." },
        ],
      },
      baseOpts(model, cleanPolicy(), sink()),
    );

    expect(result.text).toBe("Hello!");
    expect(
      model.doGenerateCalls[0]?.prompt.map((message) => message.role),
    ).toEqual(["user", "assistant", "system", "user"]);
  });
});

describe("fail-closed credit gate — reserve BEFORE the call", () => {
  test("a short wallet 402s and the model is NEVER called", async () => {
    // No seed → balance 0 < reservation.
    const s = sink();
    const model = mockModel("should not run");

    await expect(
      infer(
        "default",
        { messages: [{ role: "user", content: "expensive request" }] },
        baseOpts(model, cleanPolicy(), s),
      ),
    ).rejects.toBeInstanceOf(InsufficientCreditsError);

    expect(model.doGenerateCalls).toHaveLength(0); // never reached the provider
    const rows = await tp.query(
      `SELECT 1 FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toHaveLength(0);
  });
});

describe("guardrails — fail-closed input block", () => {
  test("a flagged input throws GuardrailError 422, never calls the model, never spends", async () => {
    await seed(1000);
    const s = sink();
    const model = mockModel("should not run");
    const policy = cleanPolicy({ moderator: localModerator(["forbidden"]) });

    await expect(
      infer(
        "default",
        { messages: [{ role: "user", content: "this is forbidden" }] },
        baseOpts(model, policy, s),
      ),
    ).rejects.toBeInstanceOf(GuardrailError);

    expect(model.doGenerateCalls).toHaveLength(0);
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(1000); // untouched
    expect(s.events[0]?.name).toBe("guardrail.blocked");
  });
});

describe("hard cap → circuit breaker", () => {
  test("crossing a hard cap trips the breaker; the next infer 402s without a call", async () => {
    await seed(1000);
    await withTenant(tp.pg, A, (tx) =>
      tx.query(
        `INSERT INTO ${SPEND_POLICY_TABLE}
           (account_id, scope, unit, window_granularity, soft_limit, hard_limit)
         VALUES ($1, 'account', 'credits', 'day', NULL, 1)`,
        [A],
      ),
    );
    const s = sink();

    // First call reserves > 1 credit → crosses the hard cap of 1 → trips the breaker.
    const first = await infer(
      "default",
      { messages: [{ role: "user", content: "first call here" }] },
      baseOpts(mockModel("one"), cleanPolicy(), s),
    );
    expect(first.reserved.breakerTripped).toBe(true);

    // Next call: the breaker is open → 402 before any spend or provider call.
    const blocked = mockModel("should not run");
    await expect(
      infer(
        "default",
        { messages: [{ role: "user", content: "second call here" }] },
        baseOpts(blocked, cleanPolicy(), s),
      ),
    ).rejects.toBeInstanceOf(SpendCapError);
    expect(blocked.doGenerateCalls).toHaveLength(0);
  });
});

describe("PII reversible tokenize round-trip", () => {
  test("the model sees redacted PII; the output restores it for the caller", async () => {
    await seed(1000);
    const ctx = derivedContext(
      new DerivedKeyProvider(Buffer.alloc(32, 0x11), Buffer.alloc(32, 0x22)),
      A,
    );
    const s = sink();
    // The model echoes the opaque placeholder back; detokenize restores the original on output.
    const model = mockModel("I'll email [[PII:email:0]] now.");
    const policy = cleanPolicy({ pii: { mode: "tokenize", ctx } });

    const res = await infer(
      "default",
      { messages: [{ role: "user", content: "write to jane@example.com" }] },
      baseOpts(model, policy, s),
    );

    // The caller gets the real address back (restored from the field-crypto envelope).
    expect(res.text).toBe("I'll email jane@example.com now.");
    // The provider only ever saw the redacted placeholder — never the raw PII.
    const sent = JSON.stringify(model.doGenerateCalls[0]);
    expect(sent).not.toContain("jane@example.com");
    expect(sent).toContain("[[PII:email:0]]");
  });
});

describe("createProviderRegistry resolver", () => {
  test("infer() runs over a registry built from the ai-config lanes", async () => {
    await seed(1000);
    const s = sink();
    const model = mockModel("from-registry");
    // A test-double ProviderV4 whose languageModel returns the mock (zero network).
    const fakeProvider: ProviderV4 = {
      specificationVersion: "v4",
      languageModel: () => model,
      embeddingModel: () => {
        throw new Error("unsupported");
      },
      imageModel: () => {
        throw new Error("unsupported");
      },
    };
    const resolveModel = buildRegistryResolver(SETTINGS, {
      openai: fakeProvider,
    });

    const res = await infer(
      "default",
      { messages: [{ role: "user", content: "hello" }] },
      baseOpts(model, cleanPolicy(), s, { resolveModel }),
    );

    expect(res.text).toBe("from-registry");
    expect(model.doGenerateCalls).toHaveLength(1);
  });
});

describe("BYOK lane — $0 wallet end-to-end (ADR-0182)", () => {
  test("a metered infer() on a BYOK lane records usage but never moves the wallet", async () => {
    await seed(1000);
    const s = sink();
    const model = mockModel("byok-ok"); // usage 10 in / 20 out → 1 credit actual

    const res = await infer(
      "byok",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), s),
    );

    expect(res.text).toBe("byok-ok");
    expect(model.doGenerateCalls).toHaveLength(1);
    // Wallet untouched across reserve + reconcile — a BYOK action debits $0.
    expect(res.reserved.balance).toBe(1000);
    expect(res.reconciled.chargedCredits).toBe(0);
    expect(res.reconciled.refundedCredits).toBe(0);
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(1000);
    // But the usage_event IS recorded with the real actual credits (internal metering still runs).
    const rows = await tp.query<{ credits: number }>(
      `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.credits).toBe(1);
    // No wallet ledger movement for the BYOK call — neither a debit nor a grant.
    const ledger = await tp.query(
      `SELECT 1 FROM credit_event
         WHERE account_id = $1 AND event_type IN ('feature_debit', 'feature_grant')`,
      [A],
    );
    expect(ledger).toHaveLength(0);
  });
});

describe("provider reports no usage — settle at reserved (no silent refund)", () => {
  test("a completed call with undefined token counts settles at the reservation, never grants a refund", async () => {
    await seed(1000);
    const s = sink();
    const model = mockModelNoUsage("done");

    const res = await infer(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), s),
    );

    expect(res.text).toBe("done");
    expect(model.doGenerateCalls).toHaveLength(1);
    // Settled at the reserved estimate — a real completed call is NEVER trued down to a full refund.
    expect(res.reserved.reservedCredits).toBeGreaterThan(0);
    expect(res.reconciled.deltaCredits).toBe(0);
    expect(res.reconciled.refundedCredits).toBe(0);
    expect(res.reconciled.actualCredits).toBe(res.reserved.reservedCredits);
    // The wallet holds the reservation (not refunded back to the full balance).
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(
      1000 - res.reserved.reservedCredits,
    );
    // The append-only usage_event carries the reserved (non-zero) credits — not a silent 0.
    const rows = await tp.query<{ credits: number }>(
      `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.credits).toBe(res.reserved.reservedCredits);
    // No feature_grant was written (the bug refunded the full reservation on unreported usage).
    const grants = await tp.query(
      `SELECT 1 FROM credit_event WHERE account_id = $1 AND event_type = 'feature_grant'`,
      [A],
    );
    expect(grants).toHaveLength(0);
  });

  test("usage that overflows a derived ledger integer is treated as unreported", async () => {
    await seed(1000);
    const s = sink();
    const model = mockModelWithUsage("done", 1, 143_165_577);
    const overflowMeter: MeterConfig = {
      priceBook: {
        "openai/model": {
          inputPerMTok: 1_000_000,
          cachedInputPerMTok: 500_000,
          outputPerMTok: 15_000_000,
        },
      },
      conversion: { microUsdPerCredit: asMicroUsdPerCredit(100) },
      ...(METER.now !== undefined ? { now: METER.now } : {}),
    };

    const res = await infer(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), s, { meter: overflowMeter }),
    );

    expect(res.reconciled.actualCredits).toBe(res.reserved.reservedCredits);
    expect(res.reconciled.refundedCredits).toBe(0);
    const rows = await tp.query<{ credits: number }>(
      `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toEqual([{ credits: res.reserved.reservedCredits }]);
  });

  test("a completed fallback larger than the reservation charges the consumed estimate", async () => {
    await seed(1000);
    const model = mockModelNoUsage("x".repeat(800));

    const res = await infer(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), sink(), { maxOutputTokens: 1 }),
    );

    expect(res.usage.outputTokens).toBe(200);
    expect(res.reconciled.actualCredits).toBeGreaterThan(
      res.reserved.reservedCredits,
    );
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(
      1000 - res.reconciled.actualCredits,
    );
  });

  test("an unsafe consumed fallback settles at the bounded reservation estimate", async () => {
    await seed(1000);
    const model = mockModelNoUsage("12345"); // chars/4 => 2 output tokens => unsafe cost

    const res = await infer(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), sink(), {
        maxOutputTokens: 1,
        meter: LEDGER_EDGE_METER,
      }),
    );

    expect(res.usage.outputTokens).toBe(1);
    expect(res.reconciled.actualCredits).toBe(res.reserved.reservedCredits);
    const rows = await tp.query<{ cost_micro_usd: number; credits: number }>(
      `SELECT cost_micro_usd, credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toEqual([{ cost_micro_usd: 2_000_000_000, credits: 1 }]);
  });

  test("an unsafe reservation estimate fails before reserve or provider execution", async () => {
    await seed(1000);
    const model = mockModelNoUsage("never reached");

    await expect(
      infer(
        "default",
        { messages: [{ role: "user", content: "ping" }] },
        baseOpts(model, cleanPolicy(), sink(), {
          maxOutputTokens: 2,
          meter: LEDGER_EDGE_METER,
        }),
      ),
    ).rejects.toThrow(
      "usage estimate cannot be represented by the PostgreSQL integer ledger",
    );
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(1000);
  });
});

describe("charge-above-reservation shortfall — orphaned reservation (CAISSON-108 finding 1)", () => {
  // Same fixture shape as "a completed fallback larger than the reservation charges the consumed
  // estimate" above (reservedCredits 1, actual fallback 5 credits — delta 4) but the wallet holds
  // ONLY the reservation: reconcile's shortfall debit has nothing left to cover the delta.
  test("infer(): a reconcile debit past the wallet classifies the failure and strands no partial write", async () => {
    await seed(1); // exactly covers the 1-credit reservation, nothing left for the 4-credit shortfall
    const model = mockModelNoUsage("x".repeat(800));

    const call = infer(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), sink(), {
        maxOutputTokens: 1,
        callId: "orphan-infer-1",
      }),
    );

    await expect(call).rejects.toBeInstanceOf(OrphanedReservationError);
    const err = (await call.catch(
      (e: unknown) => e,
    )) as OrphanedReservationError;
    expect(err.code).toBe("orphaned_reservation");
    expect(err.httpStatus).toBe(402);
    expect(err.details).toMatchObject({
      callId: "orphan-infer-1",
      reservedCredits: 1,
    });

    // reserve()'s debit (a separate, already-committed transaction) still holds exactly its
    // credit — no partial extra debit, no negative balance, nothing silently topped up.
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(0);
    // reconcile()'s usage_event insert + shortfall debit share ONE transaction and rolled back
    // together — no ledger row exists yet for this call.
    const rows = await tp.query(
      `SELECT 1 FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1 AND call_id = $2`,
      [A, "orphan-infer-1"],
    );
    expect(rows).toHaveLength(0);

    // The sweep: once the wallet is topped up, an out-of-band reconciler retries reconcile()
    // under the SAME callId — usage_event's (account, call_id) UNIQUE settles it exactly once.
    await withTenant(tp.pg, A, (tx) =>
      grant(tx, {
        accountId: A,
        amount: asCredits(10),
        eventType: "purchase",
        sourceEventId: "topup",
      }),
    );
    const usage = { inputTokens: 1, outputTokens: 200, cachedInputTokens: 0 };
    const swept = await withTenant(tp.pg, A, (tx) =>
      reconcile(tx, {
        accountId: A,
        callId: "orphan-infer-1",
        provider: "openai",
        model: "model",
        lane: "default",
        reservedCredits: 1,
        usage,
        usageReported: true,
        config: METER,
      }),
    );
    expect(swept.idempotent).toBe(false);
    expect(swept.actualCredits).toBe(5);
    expect(swept.chargedCredits).toBe(4);
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(6); // 0 + 10 - 4
    const sweptRows = await tp.query<{ credits: number }>(
      `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1 AND call_id = $2`,
      [A, "orphan-infer-1"],
    );
    expect(sweptRows).toEqual([{ credits: 5 }]);

    // A second sweep attempt (a retried request, a duplicate reconciler pass) settles once —
    // no double debit, no second row.
    const resweep = await withTenant(tp.pg, A, (tx) =>
      reconcile(tx, {
        accountId: A,
        callId: "orphan-infer-1",
        provider: "openai",
        model: "model",
        lane: "default",
        reservedCredits: 1,
        usage,
        usageReported: true,
        config: METER,
      }),
    );
    expect(resweep.idempotent).toBe(true);
    expect(resweep.chargedCredits).toBe(0);
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(6);
  });

  test("inferStream(): the same shortfall classifies the failure identically", async () => {
    await seed(1);
    const model = mockStreamModelNoUsage(["x".repeat(800)]);

    const res = await inferStream(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), sink(), {
        maxOutputTokens: 1,
        callId: "orphan-stream-1",
      }),
    );
    for await (const _delta of res.textStream) {
      // drain — the SDK-level text is unaffected, only settlement fails
    }

    await expect(res.settled).rejects.toBeInstanceOf(OrphanedReservationError);
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(0);
    const rows = await tp.query(
      `SELECT 1 FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1 AND call_id = $2`,
      [A, "orphan-stream-1"],
    );
    expect(rows).toHaveLength(0);
  });
});

describe("post-reservation model setup failure — refund", () => {
  test("infer() refunds to zero when model resolution fails after reserve", async () => {
    await seed(1000);
    const s = sink();
    const failure = new Error("resolver down");

    await expect(
      infer(
        "default",
        { messages: [{ role: "user", content: "ping" }] },
        baseOpts(mockModel(), cleanPolicy(), s, {
          resolveModel: async () => {
            throw failure;
          },
        }),
      ),
    ).rejects.toBe(failure);

    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(1000);
    const rows = await tp.query<{ credits: number }>(
      `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toEqual([{ credits: 0 }]);
  });

  test("inferStream() refunds to zero when model resolution fails after reserve", async () => {
    await seed(1000);
    const s = sink();
    const failure = new Error("stream resolver down");

    await expect(
      inferStream(
        "default",
        { messages: [{ role: "user", content: "ping" }] },
        baseOpts(mockModel(), cleanPolicy(), s, {
          resolveModel: async () => {
            throw failure;
          },
        }),
      ),
    ).rejects.toBe(failure);

    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(1000);
    const rows = await tp.query<{ credits: number }>(
      `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toEqual([{ credits: 0 }]);
  });

  test("inferStream() refunds a doStream rejection before the first delta", async () => {
    await seed(1000);
    const failure = new Error("stream setup down");
    const res = await inferStream(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(mockStreamModelReject(failure), cleanPolicy(), sink()),
    );
    const drain = async (): Promise<void> => {
      for await (const _delta of res.textStream) {
        // drain
      }
    };

    await expect(drain()).rejects.toBe(failure);
    const settled = await res.settled;
    expect(settled.reconciled.actualCredits).toBe(0);
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(1000);
    const rows = await tp.query<{ credits: number }>(
      `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toEqual([{ credits: 0 }]);
  });

  test("inferStream() refunds a middleware rejection before the first delta", async () => {
    await seed(1000);
    const failure = new Error("stream middleware down");
    const model = mockStreamModel(["never reached"], {
      inputTokens: 10,
      outputTokens: 2,
      totalTokens: 12,
    });
    const middleware: LanguageModelMiddleware = {
      specificationVersion: "v4",
      wrapStream: async () => {
        throw failure;
      },
    };
    const res = await inferStream(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), sink(), { middleware }),
    );
    const drain = async (): Promise<void> => {
      for await (const _delta of res.textStream) {
        // drain
      }
    };

    await expect(drain()).rejects.toBe(failure);
    const settled = await res.settled;
    expect(settled.reconciled.actualCredits).toBe(0);
    expect(model.doStreamCalls).toHaveLength(0);
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(1000);
    const rows = await tp.query<{ credits: number }>(
      `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toEqual([{ credits: 0 }]);
  });
});

describe("streaming infer — inferStream", () => {
  test("a stream that is never iterated still runs eagerly and reconciles", async () => {
    await seed(1000);
    const s = sink();
    const model = mockStreamModel(["unobserved"], {
      inputTokens: 10,
      outputTokens: 3,
      totalTokens: 13,
    });

    const res = await inferStream(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), s),
    );

    const settled = await settlesWithin(res.settled);
    expect(settled.abandoned).toBe(false);
    expect(settled.text).toBe("unobserved");
    expect(model.doStreamCalls).toHaveLength(1);
    const rows = await tp.query<{ credits: number }>(
      `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toEqual([{ credits: settled.reconciled.actualCredits }]);
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(
      1000 - settled.reconciled.actualCredits,
    );
  });

  test("dropping an iterator after one next without return still reconciles", async () => {
    await seed(1000);
    const s = sink();
    const model = mockStreamModel(
      ["first", "second"],
      { inputTokens: 10, outputTokens: 4, totalTokens: 14 },
      10,
    );

    const res = await inferStream(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), s),
    );
    const iterator = res.textStream[Symbol.asyncIterator]();
    expect(await iterator.next()).toEqual({ value: "first", done: false });

    const settled = await settlesWithin(res.settled);
    expect(settled.abandoned).toBe(false);
    expect(settled.text).toBe("firstsecond");
    const rows = await tp.query<{ credits: number }>(
      `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toEqual([{ credits: settled.reconciled.actualCredits }]);
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(
      1000 - settled.reconciled.actualCredits,
    );
  });

  test("return before the first next cancels and reconciles the reservation", async () => {
    await seed(1000);
    const s = sink();
    const model = mockStreamModel(
      ["late"],
      { inputTokens: 10, outputTokens: 2, totalTokens: 12 },
      50,
    );

    const res = await inferStream(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), s),
    );
    const iterator = res.textStream[Symbol.asyncIterator]();
    await iterator.return?.();

    const settled = await settlesWithin(res.settled);
    expect(settled.abandoned).toBe(true);
    const rows = await tp.query<{ credits: number }>(
      `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toEqual([{ credits: settled.reconciled.actualCredits }]);
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(
      1000 - settled.reconciled.actualCredits,
    );
  });

  test("an already-aborted signal settles ZERO — provably pre-contact, provider never reached (CAISSON-108 finding 2)", async () => {
    await seed(1000);
    const s = sink();
    const aborter = new AbortController();
    aborter.abort(new Error("caller already gone"));
    const model = mockStreamModel(
      ["late"],
      { inputTokens: 10, outputTokens: 2, totalTokens: 12 },
      50,
    );

    const res = await inferStream(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), s, { abortSignal: aborter.signal }),
    );

    const settled = await settlesWithin(res.settled);
    expect(settled.abandoned).toBe(true);
    // Provider never contacted at all — doStream was never called — so this settles ZERO, not
    // the chars/4 input-token estimate fallbackLanguageSettlement would otherwise charge.
    expect(model.doStreamCalls).toHaveLength(0);
    expect(settled.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
    });
    expect(settled.reconciled.actualCredits).toBe(0);
    const rows = await tp.query<{ credits: number }>(
      `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toEqual([{ credits: 0 }]);
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(1000);
  });

  test("an iterator remains stably done after the stream completes", async () => {
    await seed(1000);
    const model = mockStreamModel(["done"], {
      inputTokens: 10,
      outputTokens: 2,
      totalTokens: 12,
    });
    const res = await inferStream(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), sink()),
    );
    const iterator = res.textStream[Symbol.asyncIterator]();

    expect(await iterator.next()).toEqual({ done: false, value: "done" });
    expect(await iterator.next()).toEqual({ done: true, value: undefined });
    expect(await iterator.next()).toEqual({ done: true, value: undefined });
    await res.settled;
  });

  test("creating an iterator does not lock the stream before its first read", async () => {
    await seed(1000);
    const model = mockStreamModel(["done"], {
      inputTokens: 10,
      outputTokens: 2,
      totalTokens: 12,
    });
    const res = await inferStream(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), sink()),
    );
    const dormant = res.textStream[Symbol.asyncIterator]();
    expect(dormant).toBeDefined();
    const active = res.textStream[Symbol.asyncIterator]();

    expect(await active.next()).toEqual({ done: false, value: "done" });
    expect(await active.next()).toEqual({ done: true, value: undefined });
    await res.settled;
  });

  test("raw caller system messages preserve their position through inferStream", async () => {
    await seed(1000);
    const model = mockStreamModel(["Hello!"], {
      inputTokens: 10,
      outputTokens: 2,
      totalTokens: 12,
    });

    const result = await inferStream(
      "default",
      {
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "How can I help?" },
          { role: "system", content: "Answer concisely from here." },
          { role: "user", content: "Summarize that." },
        ],
      },
      baseOpts(model, cleanPolicy(), sink()),
    );

    let text = "";
    for await (const delta of result.textStream) text += delta;
    expect(text).toBe("Hello!");
    expect(
      model.doStreamCalls[0]?.prompt.map((message) => message.role),
    ).toEqual(["user", "assistant", "system", "user"]);
    await result.settled;
  });

  test("happy path: a fully-drained stream reconciles to the provider's ACTUAL usage", async () => {
    await seed(1000);
    const s = sink();
    const model = mockStreamModel(["Hi", " world", "!"], {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    });

    const res = await inferStream(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), s),
    );

    const deltas: string[] = [];
    for await (const delta of res.textStream) deltas.push(delta);
    expect(deltas.join("")).toBe("Hi world!");

    const settled = await res.settled;
    expect(settled.abandoned).toBe(false);
    expect(settled.text).toBe("Hi world!");
    expect(settled.usage).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      cachedInputTokens: 0,
    });
    // Same math as infer()'s happy path: 10 in + 20 out → 50 micro → 1 credit ACTUAL.
    expect(settled.reconciled.actualCredits).toBe(1);
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(999);
    const rows = await tp.query<{ credits: number }>(
      `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.credits).toBe(1);
  });

  test("an abandoned stream (consumer stops early) still reconciles — no leaked reservation", async () => {
    await seed(1000);
    const s = sink();
    // A finish part that would NEVER be reached if the consumer stops draining after one chunk.
    const model = mockStreamModel(
      ["Hi", " world", "!", " more", " than", " needed"],
      { inputTokens: 999, outputTokens: 999, totalTokens: 1998 },
      5,
    );

    const res = await inferStream(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), s, { maxOutputTokens: 50 }),
    );

    const deltas: string[] = [];
    for await (const delta of res.textStream) {
      deltas.push(delta);
      if (deltas.length === 2) break; // consumer walks away before `finish`
    }
    expect(deltas.join("")).toBe("Hi world");

    const settled = await res.settled;
    expect(settled.abandoned).toBe(true);
    // The provider's (huge) reported usage was NEVER consulted — reconcile used the chars/4
    // estimate over "Hi world" instead (the text actually yielded before the stream stopped).
    expect(settled.usage.outputTokens).toBeLessThan(10);
    expect(settled.usage).not.toEqual({
      inputTokens: 999,
      outputTokens: 999,
      cachedInputTokens: 0,
    });

    // The reservation is settled exactly once — one usage_event row, balance reflects the (small)
    // estimated actual rather than either the full reservation or the never-reached huge usage.
    const rows = await tp.query<{ credits: number }>(
      `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toHaveLength(1);
    const balanceAfter = await withTenant(tp.pg, A, (tx) => balance(tx, A));
    expect(balanceAfter).toBe(1000 - rows[0]!.credits);
    expect(res.reserved.reservedCredits).toBeGreaterThan(rows[0]!.credits);
  });

  test("an aborted stream (abortSignal fires mid-call) still reconciles — no leaked reservation", async () => {
    await seed(1000);
    const s = sink();
    const model = mockStreamModel(
      ["partial", " before", " abort"],
      { inputTokens: 999, outputTokens: 999, totalTokens: 1998 },
      5,
    );
    const ac = new AbortController();

    const res = await inferStream(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), s, { abortSignal: ac.signal }),
    );

    let n = 0;
    for await (const _delta of res.textStream) {
      n++;
      if (n === 1) ac.abort();
    }

    const settled = await res.settled;
    expect(settled.abandoned).toBe(true);
    // Post-contact (the provider was already reached and yielded output before the abort) —
    // this is NOT the pre-contact carve-out, so it keeps charging the consumed estimate, never
    // ZERO. Guards against the pre-contact fix (CAISSON-108 finding 2) over-reaching.
    expect(settled.usage.outputTokens).toBeGreaterThan(0);
    expect(model.doStreamCalls).toHaveLength(1);
    const rows = await tp.query(
      `SELECT 1 FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toHaveLength(1); // reconciled exactly once, never left pending
  });

  test("soft/hard cap is enforced on the streamed estimate, before the provider is ever reached", async () => {
    await seed(1000);
    await withTenant(tp.pg, A, (tx) =>
      tx.query(
        `INSERT INTO ${SPEND_POLICY_TABLE}
           (account_id, scope, unit, window_granularity, soft_limit, hard_limit)
         VALUES ($1, 'account', 'credits', 'day', NULL, 1)`,
        [A],
      ),
    );
    const s = sink();

    // First call reserves > 1 credit → crosses the hard cap of 1 → trips the breaker, identically
    // to infer()'s hard-cap test — the reserve leg is shared, unmodified, by both entry points.
    const first = await inferStream(
      "default",
      { messages: [{ role: "user", content: "first call here" }] },
      baseOpts(
        mockStreamModel(["one"], {
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
        }),
        cleanPolicy(),
        s,
      ),
    );
    expect(first.reserved.breakerTripped).toBe(true);
    // Drain + settle so the test doesn't leak an unawaited stream into the next assertion.
    for await (const _d of first.textStream) {
      // drain
    }
    await first.settled;

    // Next call: the breaker is open → reserve() 402s BEFORE inferStream even returns, so the
    // provider is never reached — identical fail-closed contract to infer().
    const blocked = mockStreamModel(["should not run"], {
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
    });
    await expect(
      inferStream(
        "default",
        { messages: [{ role: "user", content: "second call here" }] },
        baseOpts(blocked, cleanPolicy(), s),
      ),
    ).rejects.toBeInstanceOf(SpendCapError);
    expect(blocked.doStreamCalls).toHaveLength(0);
  });

  test("a stream error part propagates to the consumer and still reconciles — no leaked reservation", async () => {
    await seed(1000);
    const s = sink();
    const boom = new Error("boom");
    const model = mockStreamModelError(["partial"], boom);

    const res = await inferStream(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), s),
    );

    const drain = async (): Promise<string[]> => {
      const deltas: string[] = [];
      for await (const delta of res.textStream) deltas.push(delta);
      return deltas;
    };
    await expect(drain()).rejects.toBe(boom);

    const settled = await res.settled;
    expect(settled.abandoned).toBe(true); // no `finish` part was ever reached
    const rows = await tp.query(
      `SELECT 1 FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toHaveLength(1); // reconciled exactly once despite the stream error
  });

  test("a normal finish with no reported usage settles at the reservation, never a silent refund", async () => {
    await seed(1000);
    const s = sink();
    const model = mockStreamModelNoUsage(["done"]);

    const res = await inferStream(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), s),
    );

    const deltas: string[] = [];
    for await (const delta of res.textStream) deltas.push(delta);
    expect(deltas.join("")).toBe("done");

    const settled = await res.settled;
    expect(settled.abandoned).toBe(false); // a finish part was reached — just no usage on it
    expect(settled.reconciled.deltaCredits).toBe(0);
    expect(settled.reconciled.refundedCredits).toBe(0);
    expect(settled.reconciled.actualCredits).toBe(res.reserved.reservedCredits);
  });

  test("a finished stream fallback larger than the reservation charges the consumed estimate", async () => {
    await seed(1000);
    const model = mockStreamModelNoUsage(["x".repeat(800)]);
    const res = await inferStream(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), sink(), { maxOutputTokens: 1 }),
    );

    for await (const _delta of res.textStream) {
      // drain
    }
    const settled = await res.settled;

    expect(settled.usage.outputTokens).toBe(200);
    expect(settled.reconciled.actualCredits).toBeGreaterThan(
      res.reserved.reservedCredits,
    );
  });

  test("an output-guard block on normal finish still reconciles the actual spend before rejecting", async () => {
    await seed(1000);
    const s = sink();
    const policy = cleanPolicy({ moderator: localModerator(["forbidden"]) });
    const model = mockStreamModel(["this is ", "forbidden"], {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    });

    const res = await inferStream(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, policy, s),
    );

    const deltas: string[] = [];
    for await (const delta of res.textStream) deltas.push(delta);
    expect(deltas.join("")).toBe("this is forbidden"); // the raw stream is never guarded mid-flight

    await expect(res.settled).rejects.toBeInstanceOf(GuardrailError);

    // Tokens were already consumed before the block — settle the ACTUAL usage, not a refund.
    const rows = await tp.query<{ credits: number }>(
      `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.credits).toBe(1);
  });

  test("PII tokenized on input is restored on the settled text, but never per-delta on the raw stream", async () => {
    await seed(1000);
    const ctx = derivedContext(
      new DerivedKeyProvider(Buffer.alloc(32, 0x11), Buffer.alloc(32, 0x22)),
      A,
    );
    const s = sink();
    const model = mockStreamModel(["I'll email ", "[[PII:email:0]]", " now."], {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    });
    const policy = cleanPolicy({ pii: { mode: "tokenize", ctx } });

    const res = await inferStream(
      "default",
      { messages: [{ role: "user", content: "write to jane@example.com" }] },
      baseOpts(model, policy, s),
    );

    const deltas: string[] = [];
    for await (const delta of res.textStream) deltas.push(delta);
    // Per-delta text still carries the opaque placeholder — restoration is a whole-text operation.
    expect(deltas.join("")).toContain("[[PII:email:0]]");

    const settled = await res.settled;
    expect(settled.text).toBe("I'll email jane@example.com now.");
  });

  test("a large multi-chunk stream accumulates every delta in order on both textStream and settled.text", async () => {
    await seed(1000);
    const s = sink();
    const chunks = Array.from({ length: 50 }, (_, i) => `c${i} `);
    const model = mockStreamModel(chunks, {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    });

    const res = await inferStream(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), s),
    );

    const deltas: string[] = [];
    for await (const delta of res.textStream) deltas.push(delta);
    expect(deltas).toHaveLength(50);

    const settled = await res.settled;
    expect(settled.text).toBe(chunks.join(""));
    expect(settled.abandoned).toBe(false);
  });

  test("opts.middleware wraps the streamed provider call via wrapLanguageModel", async () => {
    await seed(1000);
    const s = sink();
    const model = mockStreamModel(["wrapped"], {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    });
    let wrapCalls = 0;
    const middleware: LanguageModelMiddleware = {
      specificationVersion: "v3",
      wrapStream: async ({ doStream }) => {
        wrapCalls++;
        return doStream();
      },
    };

    const res = await inferStream(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), s, { middleware }),
    );

    const deltas: string[] = [];
    for await (const delta of res.textStream) deltas.push(delta);
    expect(deltas.join("")).toBe("wrapped");
    expect(wrapCalls).toBe(1);
    expect((await res.settled).abandoned).toBe(false);
  });

  test("a finish with finishReason 'length' (maxOutputTokens truncation) still reconciles to the provider's ACTUAL usage", async () => {
    await seed(1000);
    const s = sink();
    const model = mockStreamModel(
      ["truncated output"],
      { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      null,
      "length",
    );

    const res = await inferStream(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), s, { maxOutputTokens: 5 }),
    );

    const deltas: string[] = [];
    for await (const delta of res.textStream) deltas.push(delta);
    expect(deltas.join("")).toBe("truncated output");

    // A finish part is a finish part regardless of finishReason — "length" still trues up to the
    // provider's reported usage, never falling back to the abandoned-stream estimate.
    const settled = await res.settled;
    expect(settled.abandoned).toBe(false);
    expect(settled.usage).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      cachedInputTokens: 0,
    });
    expect(settled.reconciled.actualCredits).toBe(1);
  });

  test("an empty stream (zero chunks, finish reports zero usage) settles a full refund — no leaked reservation", async () => {
    await seed(1000);
    const s = sink();
    const model = mockStreamModel([], {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });

    const res = await inferStream(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), s),
    );

    const deltas: string[] = [];
    for await (const delta of res.textStream) deltas.push(delta);
    expect(deltas).toHaveLength(0);

    const settled = await res.settled;
    expect(settled.abandoned).toBe(false); // a finish part WAS reached — just over zero chunks
    expect(settled.text).toBe("");
    expect(settled.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
    });
    // Zero actual cost trues the WHOLE reservation back — a real refund, not the no-usage-reported
    // settle-at-reserved path (the provider DID report usage here — it was just zero).
    expect(settled.reconciled.actualCredits).toBe(0);
    expect(settled.reconciled.refundedCredits).toBe(
      res.reserved.reservedCredits,
    );
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(1000);
    const rows = await tp.query<{ credits: number }>(
      `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.credits).toBe(0);
  });

  test("a same-callId retry on inferStream settles the meter legs EXACTLY once (idempotent)", async () => {
    await seed(1000);
    const callId = randomUUID();
    const s = sink();
    const input = { messages: [{ role: "user", content: "ping" }] } as const;
    const usage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };

    const first = await inferStream(
      "default",
      input,
      baseOpts(mockStreamModel(["Hi", " world"], usage), cleanPolicy(), s, {
        callId,
      }),
    );
    for await (const _d of first.textStream) {
      // drain
    }
    const firstSettled = await first.settled;

    const second = await inferStream(
      "default",
      input,
      baseOpts(mockStreamModel(["Hi", " world"], usage), cleanPolicy(), s, {
        callId,
      }),
    );
    for await (const _d of second.textStream) {
      // drain
    }
    const secondSettled = await second.settled;

    expect(first.reserved.idempotent).toBe(false);
    expect(firstSettled.reconciled.idempotent).toBe(false);
    expect(second.reserved.idempotent).toBe(true);
    expect(secondSettled.reconciled.idempotent).toBe(true);
    // Token accounting on the completed drain matches what actually got reconciled.
    expect(firstSettled.usage).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      cachedInputTokens: 0,
    });
    expect(firstSettled.reconciled.actualCredits).toBe(1);

    // The provider was called on each attempt, but the spend settled ONCE.
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(999);
    const rows = await tp.query<{ call_id: string }>(
      `SELECT call_id FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.call_id).toBe(callId);
  });
});

describe("trajectory observation — additive, never fails the metered call", () => {
  // A recorder that assigns the append-only envelope (runId + monotonic seq) around each gateway
  // event and appends it into a REAL memory store — the seam a governed run loop owns (CAISSON-111).
  function recordingStore(runId: string) {
    const store = createMemoryTrajectoryStore();
    let seq = 0;
    const recorder: TrajectoryRecorder = async (e) => {
      await store.append({
        eventId: randomUUID(),
        runId,
        seq: seq++,
        version: TRAJECTORY_VERSION,
        occurredAt: new Date().toISOString(),
        ...e,
      } as TrajectoryEvent);
    };
    return { store, recorder };
  }

  test("infer() emits model.call (prompt digest only) then model.usage (metered)", async () => {
    await seed(1000);
    const { store, recorder } = recordingStore("run_kit_1");
    // usage 10 in / 20 out → 1 credit actual.
    const model = mockModel("Hi world!");

    const res = await infer(
      "default",
      { messages: [{ role: "user", content: "secret prompt body" }] },
      baseOpts(model, cleanPolicy(), sink(), { recorder }),
    );
    expect(res.reconciled.actualCredits).toBe(1);

    const events = await store.read("run_kit_1");
    expect(events.map((e) => e.kind)).toEqual(["model.call", "model.usage"]);

    const call = events[0];
    expect(call?.kind).toBe("model.call");
    if (call?.kind === "model.call") {
      expect(call.payload.provider).toBe("openai");
      expect(call.payload.model).toBe("model");
      expect(call.payload.prompt.digest).toMatch(/^[0-9a-f]{64}$/);
      expect(call.payload.prompt.byteLength).toBeGreaterThan(0);
    }
    // The prompt TEXT is NEVER carried in the trajectory — digest-ref only (AR-4).
    expect(JSON.stringify(events)).not.toContain("secret prompt body");

    const usage = events[1];
    expect(usage?.kind).toBe("model.usage");
    if (usage?.kind === "model.usage") {
      expect(usage.payload.billingStatus).toBe("metered");
      expect(usage.payload.inputTokens).toBe(10);
      expect(usage.payload.outputTokens).toBe(20);
      // The ledger's OWN integer — the same credits reconcile settled.
      expect(usage.payload.credits).toBe(res.reconciled.actualCredits);
    }
  });

  test("infer() swallows a recorder failure and surfaces a trajectory.record_failed warning", async () => {
    await seed(1000);
    const s = sink();
    const boom: TrajectoryRecorder = () => {
      throw new Error("recorder down");
    };

    const res = await infer(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(mockModel("pong"), cleanPolicy(), s, { recorder: boom }),
    );

    // The metered call completes normally — observation never breaks the money path.
    expect(res.text).toBe("pong");
    expect(res.reconciled.actualCredits).toBe(1);
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(999);
    // Both emit sites failed → warnings surfaced on the guard runtime's sink, no throw.
    const warnings = s.events.filter(
      (e) => e.name === "trajectory.record_failed",
    );
    expect(warnings.length).toBe(2);
  });

  test("inferStream() emits model.call then model.usage on a normal drain", async () => {
    await seed(1000);
    const { store, recorder } = recordingStore("run_kit_stream");
    const model = mockStreamModel(["Hel", "lo"], {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    });

    const res = await inferStream(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      baseOpts(model, cleanPolicy(), sink(), { recorder }),
    );
    for await (const _delta of res.textStream) {
      // drain to a normal finish
    }
    await res.settled;

    const events = await store.read("run_kit_stream");
    expect(events.map((e) => e.kind)).toEqual(["model.call", "model.usage"]);
    const usage = events[1];
    if (usage?.kind === "model.usage") {
      expect(usage.payload.billingStatus).toBe("metered");
      expect(usage.payload.outputTokens).toBe(20);
    }
  });
});

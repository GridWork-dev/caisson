// T14 exit-gate proof for the metered inference gateway (ADR-0059). PGlite + the production
// `withTenant` shape + a mock `LanguageModelV2` (zero network): a metered `infer()` reserves BEFORE
// the provider call, reconciles to actual, fail-closed 402s on a short wallet / open breaker without
// ever calling the model, blocks a guardrailed input with a 422 (no spend), restores tokenized PII on
// the output while the model only ever sees redacted text, resolves a prompt by `name@version`, and
// runs over a `createProviderRegistry` resolver. The live provider transport stays un-exercised.
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { newTestPg, type TestPg } from "@caisson/testing";
import { CREDIT_SCHEMA_SQL, balance, grant } from "@caisson/credits";
import {
  GuardrailError,
  InMemoryEventSink,
  InsufficientCreditsError,
} from "@caisson/kernel";
import {
  AI_METER_SCHEMA_SQL,
  SPEND_POLICY_TABLE,
  SpendCapError,
  USAGE_EVENT_TABLE,
  type MeterConfig,
} from "@caisson/ai-meter";
import {
  PROMPT_REGISTRY_SCHEMA_SQL,
  registerPrompt,
} from "@caisson/prompt-registry";
import {
  localModerator,
  type GuardPolicy,
  type GuardRuntime,
} from "@caisson/guardrails";
import { DerivedKeyProvider, derivedContext } from "@caisson/field-crypto";
import type { AiSettings } from "@caisson/ai-config";
import { withTenant } from "@caisson/tenancy-rls";
import { MockLanguageModelV2 } from "ai/test";
import type { LanguageModelV2, ProviderV2 } from "@ai-sdk/provider";
import { buildRegistryResolver, infer, type InferOptions } from "./gateway.ts";

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
  conversion: { microUsdPerCredit: 100 },
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

/** A mock model with usage 10 in / 20 out → 50 micro → 1 credit actual. Echoes a fixed reply. */
function mockModel(text = "ok"): MockLanguageModelV2 {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      finishReason: "stop",
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [{ type: "text", text }],
      warnings: [],
    }),
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
  model: LanguageModelV2,
  policy: GuardPolicy,
  s: InMemoryEventSink,
  over: Partial<InferOptions> = {},
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

async function freshSchema(): Promise<void> {
  await tp.exec(
    [
      "prompt_alias",
      "prompt_version",
      USAGE_EVENT_TABLE,
      "tenant_spend_window",
      SPEND_POLICY_TABLE,
      "spend_breaker",
      "credit_event",
      "credit_wallet",
    ]
      .map((t) => `DROP TABLE IF EXISTS ${t} CASCADE;`)
      .join("\n"),
  );
  await tp.exec(CREDIT_SCHEMA_SQL);
  await tp.exec(AI_METER_SCHEMA_SQL);
  await tp.exec(PROMPT_REGISTRY_SCHEMA_SQL);
}

async function seed(amount: number): Promise<void> {
  await withTenant(tp.pg, A, (tx) =>
    grant(tx, {
      accountId: A,
      amount,
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
    // A test-double ProviderV2 whose languageModel returns the mock (zero network).
    const fakeProvider: ProviderV2 = {
      languageModel: () => model,
      textEmbeddingModel: () => {
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

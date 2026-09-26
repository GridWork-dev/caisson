// End-to-end integration proof for the metered inference gateway (ADR-0059). Where
// `gateway.test.ts` exercises each pipeline leg in isolation, this drives the WHOLE composition
// against real schemas on PGlite (the production `withTenant` shape) with a test-doubled
// `LanguageModelV4` (zero network — the live transport stays the only un-exercised path):
//
//   - the happy path metered call: resolve `name@version` → render → reserve BEFORE the provider call
//     → reconcile to ACTUAL, with the wallet, the append-only `usage_event`, and the spend window all
//     asserted at ground truth;
//   - a same-`callId` retry settles EXACTLY ONCE (reserve + reconcile idempotent);
//   - an empty wallet 402s before any provider call and records no `usage_event` (fail-closed);
//   - a hard spend cap trips the breaker so the NEXT call 402s without reaching the provider;
//   - a flagged input throws `GuardrailError` 422, never calls the model, never spends, and emits a
//     metadata-only `guardrail.blocked` event to the `EventSink`;
//   - the render → usage → eval LINKAGE: the immutable `prompt_version_id` threads from the rendered
//     gateway call, through the recorded `usage_event`, into a `@caisson-sh/ai-evals` run over that same
//     version — one UUID attributable end-to-end (ADR-0061/0062).
//
// `@caisson-sh/ai-evals` is a base PRIMITIVE; the ai-kit edition composing it is the allowed DOWN
// direction (ADR-0003). It is a test-only devDependency — the eval gate is its own package + CI job.
import { randomUUID } from "node:crypto";
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
  type MeterConfig,
} from "@caisson-sh/ai-meter";
import {
  PROMPT_REGISTRY_SCHEMA_SQL,
  registerPrompt,
} from "@caisson-sh/prompt-registry";
import type { PromptVersion } from "@caisson-sh/prompt-registry";
import {
  localModerator,
  type GuardPolicy,
  type GuardRuntime,
} from "@caisson-sh/guardrails";
import { defineEval, exactGrader } from "@caisson-sh/ai-evals";
import type { AiSettings } from "@caisson-sh/ai-config";
import { withTenant } from "@caisson-sh/tenancy-rls";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { infer, type InferOptions } from "./gateway.ts";

let tp: TestPg;
const A = "acct_kit_integ";

// A fixed price book + denomination + clock makes the integer money math deterministic. 1 input
// token = $1/MTok, output 2×, 1 credit = 100 micro-USD; provider/model = "openai/model". A mock call
// of 10 in / 20 out → (10·1 + 20·2) = 50 micro → ceil(50/100) = 1 credit ACTUAL.
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

/** A mock model: usage 10 in / 20 out, echoes a fixed reply. Zero network. */
function mockModel(text = "ok"): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: {
          total: 10,
          noCache: 10,
          cacheRead: 0,
          cacheWrite: 0,
        },
        outputTokens: { total: 20, text: 20, reasoning: 0 },
      },
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
  model: LanguageModelV4,
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
      sourceEventId: `seed:${randomUUID()}`,
    }),
  );
}

interface UsageRow {
  call_id: string;
  prompt_version_id: string | null;
  lane: string;
  provider: string;
  model: string;
  credits: number;
  cost_micro_usd: number;
}

function usageRows(): Promise<UsageRow[]> {
  return tp.query<UsageRow>(
    `SELECT call_id, prompt_version_id, lane, provider, model, credits, cost_micro_usd
       FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
    [A],
  );
}

async function registerPromptVersion(
  name: string,
  content: string,
  varName: string,
): Promise<PromptVersion> {
  return withTenant(tp.pg, A, (tx) =>
    registerPrompt(tx, {
      accountId: A,
      name,
      messages: [{ role: "user", content }],
      varSpec: { [varName]: "string" },
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

describe("full pipeline — resolve(name@version) → render → reserve → call → reconcile", () => {
  test("the metered call trues to actual; the render → usage link is recorded at ground truth", async () => {
    await seed(1000);
    const version = await registerPromptVersion(
      "greet",
      "Hi {{name}}!",
      "name",
    );
    const s = sink();
    const model = mockModel("Hi world!");

    const res = await infer(
      "default",
      { promptRef: "greet@1", vars: { name: "world" } },
      baseOpts(model, cleanPolicy(), s),
    );

    // The gateway resolved the prompt by name@version and rendered it (the RENDER link).
    expect(res.text).toBe("Hi world!");
    expect(res.promptVersionId).toBe(version.id);
    expect(res.reserved.reservedCredits).toBeGreaterThan(0);
    expect(res.reserved.idempotent).toBe(false);
    expect(res.reconciled.idempotent).toBe(false);
    expect(res.reconciled.actualCredits).toBe(1); // 10 in + 20 out → 50 micro → 1 credit
    expect(res.usage).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      cachedInputTokens: 0,
    });
    expect(model.doGenerateCalls).toHaveLength(1);

    // The wallet settled to the ACTUAL charge, not the (larger) reservation.
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(999);

    // The append-only usage_event is the recorded USAGE link: it carries the exact prompt version.
    const rows = await usageRows();
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row?.prompt_version_id).toBe(version.id);
    expect(row?.call_id).toBe(res.callId);
    expect(row?.lane).toBe("default");
    expect(row?.provider).toBe("openai");
    expect(row?.model).toBe("model");
    expect(row?.credits).toBe(1);
    expect(row?.cost_micro_usd).toBe(50);
  });

  test("a same-callId retry settles EXACTLY once — reserve + reconcile are idempotent", async () => {
    await seed(1000);
    const callId = randomUUID();
    const s = sink();
    const input = { messages: [{ role: "user", content: "ping" }] } as const;

    const first = await infer(
      "default",
      input,
      baseOpts(mockModel("pong"), cleanPolicy(), s, { callId }),
    );
    const second = await infer(
      "default",
      input,
      baseOpts(mockModel("pong"), cleanPolicy(), s, { callId }),
    );

    // First leg applied; the retry replayed both meter legs without a second debit/charge.
    expect(first.reserved.idempotent).toBe(false);
    expect(first.reconciled.idempotent).toBe(false);
    expect(second.reserved.idempotent).toBe(true);
    expect(second.reconciled.idempotent).toBe(true);

    // The provider was called on each attempt, but the spend settled ONCE.
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(999);
    const rows = await usageRows();
    expect(rows).toHaveLength(1); // UNIQUE (account, call_id) — one settlement only
    expect(rows[0]?.call_id).toBe(callId);
  });
});

describe("fail-closed credit gate — reserve BEFORE the provider call", () => {
  test("an empty wallet 402s, never calls the model, and records no usage_event", async () => {
    const s = sink();
    const model = mockModel("should not run");

    const err = await infer(
      "default",
      { messages: [{ role: "user", content: "an expensive request here" }] },
      baseOpts(model, cleanPolicy(), s),
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(InsufficientCreditsError);
    expect((err as InsufficientCreditsError).httpStatus).toBe(402);
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(await usageRows()).toHaveLength(0);
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(0);
  });
});

describe("hard cap → circuit breaker → 402", () => {
  test("crossing a hard cap trips the breaker; the next infer 402s without a provider call", async () => {
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
      { messages: [{ role: "user", content: "the first call here" }] },
      baseOpts(mockModel("one"), cleanPolicy(), s),
    );
    expect(first.reserved.breakerTripped).toBe(true);

    // Next call: the breaker is open → 402 before any spend or provider call.
    const blocked = mockModel("should not run");
    const err = await infer(
      "default",
      { messages: [{ role: "user", content: "the second call here" }] },
      baseOpts(blocked, cleanPolicy(), s),
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SpendCapError);
    expect((err as SpendCapError).httpStatus).toBe(402);
    expect(blocked.doGenerateCalls).toHaveLength(0);
  });
});

describe("guardrails — fail-closed input block → 422", () => {
  test("a flagged input throws GuardrailError 422, never calls the model or spends, emits a metadata event", async () => {
    await seed(1000);
    const s = sink();
    const model = mockModel("should not run");
    const policy = cleanPolicy({ moderator: localModerator(["forbidden"]) });

    const err = await infer(
      "default",
      { messages: [{ role: "user", content: "this is forbidden content" }] },
      baseOpts(model, policy, s),
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GuardrailError);
    expect((err as GuardrailError).httpStatus).toBe(422);
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(await usageRows()).toHaveLength(0);
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(1000); // untouched
    // A metadata-only event reached the EventSink (never the flagged content itself).
    expect(s.events[0]?.name).toBe("guardrail.blocked");
  });
});

describe("render → usage → eval linkage recorded", () => {
  test("one immutable prompt version threads render → usage_event → an ai-evals run", async () => {
    await seed(1000);
    const version = await registerPromptVersion(
      "qa",
      "Capital of {{country}}?",
      "country",
    );
    const s = sink();

    const res = await infer(
      "default",
      { promptRef: "qa@1", vars: { country: "France" } },
      baseOpts(mockModel("Paris"), cleanPolicy(), s),
    );

    // RENDER: the gateway resolved + rendered the exact version.
    expect(res.text).toBe("Paris");
    const promptVersionId = res.promptVersionId;
    if (promptVersionId === null) {
      throw new Error("expected a resolved prompt_version_id");
    }
    expect(promptVersionId).toBe(version.id);

    // USAGE: the recorded usage_event carries that same version id.
    const rows = await usageRows();
    expect(rows).toHaveLength(1);
    const recordedVersionId = rows[0]?.prompt_version_id ?? null;
    if (recordedVersionId === null) {
      throw new Error(
        "expected a recorded usage_event with a prompt_version_id",
      );
    }
    expect(recordedVersionId).toBe(promptVersionId);

    // EVAL: an ai-evals run over the SAME version grades the gateway's actual output. The eval is
    // prompt-version-bound (ADR-0062), so the run is attributable to the exact recorded version.
    const run = await defineEval({
      name: "qa-smoke",
      promptVersionId,
      promptRef: "qa@1",
      threshold: 1,
      cases: [
        {
          id: "france",
          input: { country: "France" },
          output: res.text,
          expected: { equals: "Paris" },
        },
      ],
      scorers: { exact: exactGrader() },
    });

    expect(run.passed).toBe(true);
    expect(run.score).toBe(1);
    // The full chain: render id === recorded usage id === eval run id — one UUID end-to-end.
    expect(run.promptVersionId).toBe(promptVersionId);
    expect(run.promptVersionId).toBe(recordedVersionId);
  });
});

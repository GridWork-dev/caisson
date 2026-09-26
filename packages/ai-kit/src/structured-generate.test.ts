// Exit-gate proof for structuredGenerate<T>(): a metered infer() call over PGlite + a mock
// `LanguageModelV4` (zero network), same fixture shape as gateway.test.ts. Three outcomes: a
// well-formed JSON completion parses into the typed value, an empty completion (a refusal) throws
// `StructuredGenerateError` with reason "refusal", and a non-JSON completion throws with reason
// "invalid_json" — a schema mismatch on well-formed JSON throws with reason "schema_mismatch".
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { newTestPg, type TestPg } from "@caisson-sh/testing";
import {
  CREDIT_EXPIRY_MIGRATION_SQL,
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
  GRANT_CONSUMPTION_MIGRATION_SQL,
  grant,
} from "@caisson-sh/credits";
import {
  InMemoryEventSink,
  asCredits,
  asMicroUsdPerCredit,
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
import { z } from "zod";
import { MockLanguageModelV4 } from "ai/test";
import type { InferOptions } from "./gateway.ts";
import {
  StructuredGenerateError,
  structuredGenerate,
} from "./structured-generate.ts";

let tp: TestPg;
const A = "acct_kit_structgen";

const METER: MeterConfig = {
  priceBook: {
    "openai/model": {
      inputPerMTok: 1_000_000,
      cachedInputPerMTok: 500_000,
      outputPerMTok: 2_000_000,
    },
  },
  conversion: { microUsdPerCredit: asMicroUsdPerCredit(100) },
  now: new Date("2026-07-03T12:00:00Z"),
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

/** A mock model that echoes a fixed completion text with a small deterministic usage. */
function mockModel(text: string): MockLanguageModelV4 {
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

function baseOpts(model: MockLanguageModelV4): InferOptions {
  const policy: GuardPolicy = {
    policyName: "default",
    moderator: localModerator([]),
  };
  const runtime: GuardRuntime = { tenantId: A, sink: new InMemoryEventSink() };
  return {
    tx: tp.pg,
    accountId: A,
    settings: SETTINGS,
    resolveModel: () => model,
    guard: { policy, runtime },
    meter: METER,
    maxOutputTokens: 50,
  };
}

beforeEach(async () => {
  if (!tp) tp = await newTestPg();
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
  await withTenant(tp.pg, A, (tx) =>
    grant(tx, {
      accountId: A,
      amount: asCredits(1000),
      eventType: "purchase",
      sourceEventId: "seed",
    }),
  );
});

afterAll(async () => {
  await tp.close();
});

const GreetSchema = z.object({ greeting: z.string(), loud: z.boolean() });

describe("structuredGenerate", () => {
  test("parses a well-formed JSON completion into the typed value", async () => {
    const model = mockModel('{"greeting":"hi","loud":true}');
    const result = await structuredGenerate(
      GreetSchema,
      "default",
      { messages: [{ role: "user", content: "greet" }] },
      baseOpts(model),
    );
    expect(result.value).toEqual({ greeting: "hi", loud: true });
    expect(result.raw.text).toBe('{"greeting":"hi","loud":true}');
  });

  test("throws a typed error with reason 'refusal' on an empty completion", async () => {
    const model = mockModel("   ");
    let err: unknown;
    try {
      await structuredGenerate(
        GreetSchema,
        "default",
        { messages: [{ role: "user", content: "greet" }] },
        baseOpts(model),
      );
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(StructuredGenerateError);
    expect((err as StructuredGenerateError).reason).toBe("refusal");
  });

  test("throws a typed error with reason 'invalid_json' on malformed JSON", async () => {
    const model = mockModel("not json at all {");
    let err: unknown;
    try {
      await structuredGenerate(
        GreetSchema,
        "default",
        { messages: [{ role: "user", content: "greet" }] },
        baseOpts(model),
      );
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(StructuredGenerateError);
    expect((err as StructuredGenerateError).reason).toBe("invalid_json");
  });

  test("throws a typed error with reason 'schema_mismatch' on well-formed JSON that fails the schema", async () => {
    const model = mockModel('{"greeting":"hi"}'); // missing required `loud`
    let err: unknown;
    try {
      await structuredGenerate(
        GreetSchema,
        "default",
        { messages: [{ role: "user", content: "greet" }] },
        baseOpts(model),
      );
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(StructuredGenerateError);
    expect((err as StructuredGenerateError).reason).toBe("schema_mismatch");
  });
});

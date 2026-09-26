// LIVE embeddings proof (ADR-0213) — the one path CI never exercises, run against the REAL
// OpenRouter embeddings endpoint through the FULL production pipeline: ai-config lane → registry
// resolver over `defaultProviders` (the same `@ai-sdk/openai-compatible` transport ADR-0201 wired for
// chat) → reserve → live provider call → reconcile, with PGlite backing the meter legs. Mirrors
// `gateway.live.test.ts`'s shape/convention for the embeddings surface — `createOpenAICompatible`'s
// `textEmbeddingModel()` POSTs `{baseURL}/embeddings`, OpenRouter's real endpoint.
//
// Lives OUTSIDE ./src (the default suite, CI, and the published tarball never see it; run via
// `bun run test:live`) and ADDITIONALLY self-skips without `OPENROUTER_API_KEY` — the ADR-0201
// live-test convention.
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { newTestPg, type TestPg } from "@caisson-sh/testing";
import {
  CREDIT_EXPIRY_MIGRATION_SQL,
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
  GRANT_CONSUMPTION_MIGRATION_SQL,
  grant,
} from "@caisson-sh/credits";
import { asCredits, asMicroUsdPerCredit } from "@caisson-sh/kernel";
import {
  AI_METER_SCHEMA_SQL,
  SPEND_POLICY_TABLE,
  USAGE_EVENT_TABLE,
  type MeterConfig,
} from "@caisson-sh/ai-meter";
import { withTenant } from "@caisson-sh/tenancy-rls";
import type { AiSettings } from "@caisson-sh/ai-config";
import {
  buildEmbeddingRegistryResolver,
  embed,
  embedMany,
  type EmbedOptions,
} from "../src/embed.ts";
import { defaultProviders } from "../src/providers.ts";

const HAVE_KEY = (process.env.OPENROUTER_API_KEY ?? "").length > 0;
// qwen3-embedding-8b is the same live embedding model `services/docs`' OpenRouter embedder uses
// (ADR-0096) — a real, cheap, known-good OpenRouter embeddings model.
const MODEL =
  process.env.CAISSON_LIVE_OPENROUTER_EMBEDDING_MODEL ??
  "qwen/qwen3-embedding-8b";
const A = "acct_kit_embed_live";
const LIVE_TIMEOUT_MS = 60_000;

// Same deterministic integer-money shape as embed.test.ts / gateway.live.test.ts: $1/MTok input, 1
// credit = 100 micro-USD, keyed on the live lane's provider/model.
const METER: MeterConfig = {
  priceBook: {
    [`openrouter/${MODEL}`]: {
      inputPerMTok: 1_000_000,
      cachedInputPerMTok: 500_000,
      outputPerMTok: 2_000_000,
    },
  },
  conversion: { microUsdPerCredit: asMicroUsdPerCredit(100) },
};

const SETTINGS: AiSettings = {
  defaultLane: "live",
  lanes: {
    live: {
      provider: "openrouter",
      model: MODEL,
      keySource: "env",
      apiKeyEnv: "OPENROUTER_API_KEY",
    },
  },
};

let tp: TestPg;

function liveOpts(): EmbedOptions {
  return {
    tx: tp.pg,
    accountId: A,
    settings: SETTINGS,
    // The REAL production wiring: registry resolver over the openai-compatible providers.
    resolveModel: buildEmbeddingRegistryResolver(
      SETTINGS,
      defaultProviders(SETTINGS),
    ),
    meter: METER,
  };
}

beforeEach(async () => {
  if (!HAVE_KEY) return; // keep the credential-less run at zero side effects
  if (!tp) tp = await newTestPg();
  await tp.exec(
    [
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
  if (tp) await tp.close();
});

describe("live OpenRouter embeddings (ADR-0213)", () => {
  test.skipIf(!HAVE_KEY)(
    "embed() completes against the real endpoint with REAL reported usage and a settled debit",
    async () => {
      const res = await embed(
        "live",
        "Reply with exactly one word: pong",
        liveOpts(),
      );

      expect(res.embedding.length).toBeGreaterThan(0);
      expect(res.usage.inputTokens).toBeGreaterThan(0);
      expect(res.usage.outputTokens).toBe(0);
      // The meter settled a real debit (ceil rounding: any nonzero usage ≥ 1 credit).
      expect(res.reconciled.actualCredits).toBeGreaterThan(0);
      expect(res.reconciled.balance).toBeLessThan(1000);
    },
    LIVE_TIMEOUT_MS,
  );

  test.skipIf(!HAVE_KEY)(
    "embedMany() batches a real multi-value call into ONE reservation/reconcile pair",
    async () => {
      const res = await embedMany(
        "live",
        ["the quick brown fox", "jumps over the lazy dog"],
        liveOpts(),
      );

      expect(res.embeddings).toHaveLength(2);
      expect(res.usage.inputTokens).toBeGreaterThan(0);
      expect(res.reconciled.actualCredits).toBeGreaterThan(0);
    },
    LIVE_TIMEOUT_MS,
  );
});

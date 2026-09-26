// LIVE gateway proof (ADR-0201) — the one path CI never exercises, run against the REAL OpenRouter
// chat-completions endpoint through the FULL production pipeline: ai-config lane → registry resolver
// over `defaultProviders` (the `@ai-sdk/openai-compatible` transport this ADR swapped in) → guard →
// reserve → live provider call → reconcile, with PGlite backing the meter legs. The load-bearing
// asserts are the usage counts: the pre-ADR-0201 `createOpenAI` transport would POST
// `{baseURL}/responses` (beta on OpenRouter) instead of `/chat/completions`, a defect only a live
// call can surface — real reported input/output tokens prove the chat path end-to-end.
//
// Lives OUTSIDE ./src (the default suite, CI, and the published tarball never see it; run via
// `bun run test:live`) and ADDITIONALLY self-skips without `OPENROUTER_API_KEY` — the ADR-0201
// live-test convention, following the oscal-cli availability-probe precedent (ADR-0180).
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
import { localModerator } from "@caisson-sh/guardrails";
import { withTenant } from "@caisson-sh/tenancy-rls";
import type { AiSettings } from "@caisson-sh/ai-config";
import {
  buildRegistryResolver,
  infer,
  inferStream,
  type InferOptions,
} from "../src/gateway.ts";
import { defaultProviders } from "../src/providers.ts";

const HAVE_KEY = (process.env.OPENROUTER_API_KEY ?? "").length > 0;
const MODEL = process.env.CAISSON_LIVE_OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
const A = "acct_kit_live";
const LIVE_TIMEOUT_MS = 60_000;

// Same deterministic integer-money shape as gateway.test.ts ($1/MTok in, $2/MTok out, 1 credit =
// 100 micro-USD) keyed on the live lane's provider/model — `ceil` rounding means ANY nonzero usage
// debits ≥ 1 credit, so "the call debited" is assertable without depending on the model's verbosity.
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

function liveOpts(): InferOptions {
  return {
    tx: tp.pg,
    accountId: A,
    settings: SETTINGS,
    // The REAL production wiring: registry resolver over the openai-compatible providers.
    resolveModel: buildRegistryResolver(SETTINGS, defaultProviders(SETTINGS)),
    guard: {
      policy: { policyName: "default", moderator: localModerator([]) },
      runtime: { tenantId: A, sink: new InMemoryEventSink() },
    },
    meter: METER,
    // Deliberately larger than the one-word response so a reported-usage reconciliation must refund
    // part of the reservation. The provider still produces only the requested one-word output.
    maxOutputTokens: 512,
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

describe("live OpenRouter gateway (ADR-0201)", () => {
  test.skipIf(!HAVE_KEY)(
    "infer() completes on /chat/completions with REAL reported usage and a settled debit",
    async () => {
      const res = await infer(
        "live",
        {
          messages: [
            { role: "user", content: "Reply with exactly one word: pong" },
          ],
        },
        liveOpts(),
      );

      expect(res.text.length).toBeGreaterThan(0);
      // The Responses-API defect would never get here (404 on OpenRouter) — and a chat call that
      // completed without provider-reported usage would fail these (the estimate path reports the
      // same fields, but a zero here means the wire returned nothing usable either way).
      expect(res.usage.inputTokens).toBeGreaterThan(0);
      expect(res.usage.outputTokens).toBeGreaterThan(0);
      // The meter settled a real debit (ceil rounding: any nonzero usage ≥ 1 credit).
      expect(res.reconciled.actualCredits).toBeGreaterThan(0);
      expect(res.reconciled.actualCredits).toBeLessThan(
        res.reserved.reservedCredits,
      );
      expect(res.reconciled.refundedCredits).toBeGreaterThan(0);
      expect(res.reconciled.balance).toBeLessThan(1000);
    },
    LIVE_TIMEOUT_MS,
  );

  test.skipIf(!HAVE_KEY)(
    "inferStream() drains to the model's finish and reconciles reported usage",
    async () => {
      const res = await inferStream(
        "live",
        {
          messages: [
            { role: "user", content: "Reply with exactly one word: pong" },
          ],
        },
        liveOpts(),
      );

      let text = "";
      for await (const delta of res.textStream) text += delta;
      const settled = await res.settled;

      // A drained stream that reached the provider's own `finish` part — with `includeUsage` set on
      // the compatible transport, that finish carries usage (`stream_options.include_usage`).
      expect(settled.abandoned).toBe(false);
      expect(text.length).toBeGreaterThan(0);
      expect(settled.usage.inputTokens).toBeGreaterThan(0);
      expect(settled.usage.outputTokens).toBeGreaterThan(0);
      expect(settled.reconciled.actualCredits).toBeGreaterThan(0);
      expect(settled.reconciled.actualCredits).toBeLessThan(
        res.reserved.reservedCredits,
      );
      expect(settled.reconciled.refundedCredits).toBeGreaterThan(0);
    },
    LIVE_TIMEOUT_MS,
  );
});

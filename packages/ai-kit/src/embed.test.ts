// Exit-gate proof for the metered embeddings gateway (ADR-0213): `embed()`/`embedMany()`
// reserve BEFORE the provider call, reconcile to the provider's actual usage (or the chars/4 fallback
// on an unreported one), zero-debit a BYOK lane, and refund a failed provider call — over PGlite + a
// mock `EmbeddingModelV4` (zero network). Mirrors `gateway.test.ts`'s fixtures/shape for the
// embeddings surface (no prompt-registry, no guardrails — out of scope for embeddings).
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
  InsufficientCreditsError,
  asCredits,
  asMicroUsdPerCredit,
} from "@caisson-sh/kernel";
import {
  AI_METER_SCHEMA_SQL,
  SPEND_POLICY_TABLE,
  USAGE_EVENT_TABLE,
  type MeterConfig,
} from "@caisson-sh/ai-meter";
import type { AiSettings } from "@caisson-sh/ai-config";
import { withTenant } from "@caisson-sh/tenancy-rls";
import { MockEmbeddingModelV4 } from "ai/test";
import { embed, embedMany, type EmbedOptions } from "./embed.ts";

let tp: TestPg;
const A = "acct_kit_embed";

// A fixed price book + denomination + clock, same deterministic shape as gateway.test.ts's METER:
// $1/MTok input, 1 credit = 100 micro-USD. `outputPerMTok` is deliberately NONZERO — the reservation's
// phantom output budget must refund in full at reconcile regardless of this rate (by design).
const METER: MeterConfig = {
  priceBook: {
    "openai/text-embedding-3-small": {
      inputPerMTok: 1_000_000,
      cachedInputPerMTok: 500_000,
      outputPerMTok: 2_000_000,
    },
  },
  conversion: { microUsdPerCredit: asMicroUsdPerCredit(100) },
  now: new Date("2026-07-02T12:00:00Z"),
};

const SETTINGS: AiSettings = {
  defaultLane: "default",
  lanes: {
    default: {
      provider: "openai",
      model: "text-embedding-3-small",
      apiKeyEnv: "OPENAI_API_KEY",
    },
    // A per-tenant BYOK lane (ADR-0182) — same price key, but a metered action debits $0.
    byok: {
      provider: "openai",
      model: "text-embedding-3-small",
      keySource: "tenant",
    },
  },
};

/** A mock embedding model reporting `tokens` usage, returning `vectors` for the whole batch in ONE
 *  `doEmbed` call (`maxEmbeddingsPerCall: Infinity` — the mock's default of 1 would otherwise chunk
 *  `embedMany` into one call per value, defeating the "one call for the batch" fixture shape). */
function mockEmbeddingModel(
  vectors: number[][],
  tokens: number,
): MockEmbeddingModelV4 {
  return new MockEmbeddingModelV4({
    maxEmbeddingsPerCall: Infinity,
    doEmbed: async () => ({
      embeddings: vectors,
      usage: { tokens },
      warnings: [],
    }),
  });
}

/** A mock model that completes successfully but reports NO usage (the AI SDK substitutes
 *  `{ tokens: NaN }` for this — `normalizeEmbeddingUsage` treats that as unreported). */
function mockEmbeddingModelNoUsage(vector: number[]): MockEmbeddingModelV4 {
  return new MockEmbeddingModelV4({
    maxEmbeddingsPerCall: Infinity,
    doEmbed: async () => ({ embeddings: [vector], warnings: [] }),
  });
}

/** A mock model whose `doEmbed` throws a plain, non-retryable `Error` on the first attempt. */
function mockFailingEmbeddingModel(): MockEmbeddingModelV4 {
  return new MockEmbeddingModelV4({
    maxEmbeddingsPerCall: Infinity,
    doEmbed: async () => {
      throw new Error("provider down");
    },
  });
}

async function freshSchema(): Promise<void> {
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

function baseOpts(
  model: MockEmbeddingModelV4,
  over: Partial<EmbedOptions> = {},
): EmbedOptions {
  return {
    tx: tp.pg,
    accountId: A,
    settings: SETTINGS,
    resolveModel: () => model,
    meter: METER,
    ...over,
  };
}

beforeEach(async () => {
  if (!tp) tp = await newTestPg();
  await freshSchema();
});

afterAll(async () => {
  await tp.close();
});

describe("embed() — happy path", () => {
  test("reserves before the call, reconciles to actual, refunds the phantom output leg", async () => {
    await seed(1000);
    const model = mockEmbeddingModel([[0.1, 0.2, 0.3]], 10); // 10 in -> 10 micro -> 1 credit

    const res = await embed("default", "hello world", baseOpts(model));

    expect(res.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(res.usage).toEqual({
      inputTokens: 10,
      outputTokens: 0,
      cachedInputTokens: 0,
    });
    // The reservation phantom-budgeted DEFAULT_OUTPUT_TOKENS (1024) output tokens (no maxOutputTokens
    // is ever passed to reserve()); the actual embed call has NONE — the whole output leg refunds at
    // reconcile regardless of the (nonzero) outputPerMTok rate in the price book.
    expect(res.reserved.reservedCredits).toBeGreaterThan(1);
    expect(res.reconciled.actualCredits).toBe(1);
    expect(res.reconciled.actualCredits).toBeLessThan(
      res.reserved.reservedCredits,
    );
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(1000 - 1);
    const rows = await tp.query<{ credits: number }>(
      `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.credits).toBe(1);
  });
});

describe("embedMany() — batch sizing", () => {
  test("one reservation/reconcile pair covers the whole batch, not one per value", async () => {
    await seed(1000);
    const model = mockEmbeddingModel(
      [
        [0.1, 0.1],
        [0.2, 0.2],
        [0.3, 0.3],
      ],
      30,
    );

    const res = await embedMany("default", ["a", "b", "c"], baseOpts(model));

    expect(res.embeddings).toHaveLength(3);
    expect(res.usage).toEqual({
      inputTokens: 30,
      outputTokens: 0,
      cachedInputTokens: 0,
    });
    const rows = await tp.query<{ credits: number }>(
      `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toHaveLength(1); // one usage_event for the whole batch
    expect(rows[0]?.credits).toBe(1); // 30 in -> 30 micro -> ceil(30/100) = 1 credit
  });
});

describe("fail-closed credit gate — reserve BEFORE the call", () => {
  test("a short wallet 402s and the model is never called", async () => {
    // No seed → balance 0 < reservation. Uses the failing mock so a stray call would surface loudly.
    const model = mockFailingEmbeddingModel();

    await expect(
      embed("default", "expensive value", baseOpts(model)),
    ).rejects.toBeInstanceOf(InsufficientCreditsError);

    const rows = await tp.query(
      `SELECT 1 FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toHaveLength(0);
  });
});

describe("provider failure — refund", () => {
  test("a thrown doEmbed refunds the reservation to zero and rethrows", async () => {
    await seed(1000);
    const model = mockFailingEmbeddingModel();

    await expect(embed("default", "x", baseOpts(model))).rejects.toThrow(
      "provider down",
    );

    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(1000);
    const rows = await tp.query<{ credits: number }>(
      `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.credits).toBe(0); // settled at ZERO_USAGE — never charged for a non-delivering call
  });

  test("embed() refunds to zero when model resolution fails after reserve", async () => {
    await seed(1000);
    const failure = new Error("embedding resolver down");
    const model = mockEmbeddingModel([[0.1]], 1);

    await expect(
      embed(
        "default",
        "x",
        baseOpts(model, {
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

  test("embedMany() refunds to zero when model resolution fails after reserve", async () => {
    await seed(1000);
    const failure = new Error("batch embedding resolver down");
    const model = mockEmbeddingModel([[0.1]], 1);

    await expect(
      embedMany(
        "default",
        ["x"],
        baseOpts(model, {
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
});

describe("provider reports no usage — chars/4 fallback (not a full refund)", () => {
  test("an unreported usage falls back to the chars/4 estimate over the embedded value", async () => {
    await seed(1000);
    const model = mockEmbeddingModelNoUsage([0.5, 0.5]);
    const value =
      "a value with enough characters to estimate a nonzero token count";

    const res = await embed("default", value, baseOpts(model));

    expect(res.usage.inputTokens).toBe(Math.ceil(value.length / 4));
    expect(res.usage.outputTokens).toBe(0);
    expect(res.reconciled.actualCredits).toBeGreaterThan(0);
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(
      1000 - res.reconciled.actualCredits,
    );
  });

  test("a reported usage whose derived cost overflows the ledger falls back safely", async () => {
    await seed(1000);
    const model = mockEmbeddingModel([[0.5, 0.5]], 143_165_577);
    const meter: MeterConfig = {
      priceBook: {
        "openai/text-embedding-3-small": {
          inputPerMTok: 15_000_000,
          cachedInputPerMTok: 15_000_000,
          outputPerMTok: 0,
        },
      },
      conversion: { microUsdPerCredit: asMicroUsdPerCredit(100) },
    };

    const res = await embed("default", "x", baseOpts(model, { meter }));

    expect(res.usage).toEqual({
      inputTokens: 1,
      outputTokens: 0,
      cachedInputTokens: 0,
    });
    expect(res.reconciled.actualCredits).toBe(1);
    const rows = await tp.query<{ credits: number }>(
      `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toEqual([{ credits: 1 }]);
  });

  test("an unsafe deterministic fallback fails before reserve or provider execution", async () => {
    await seed(1000);
    const model = mockEmbeddingModelNoUsage([0.5, 0.5]);
    const meter: MeterConfig = {
      priceBook: {
        "openai/text-embedding-3-small": {
          inputPerMTok: 2_000_000_000_000_000,
          cachedInputPerMTok: 0,
          outputPerMTok: 0,
        },
      },
      conversion: {
        microUsdPerCredit: asMicroUsdPerCredit(2_000_000_000),
      },
    };

    await expect(
      embed("default", "12345", baseOpts(model, { meter })),
    ).rejects.toThrow(
      "usage estimate cannot be represented by the PostgreSQL integer ledger",
    );
    expect(model.doEmbedCalls).toHaveLength(0);
    expect(await withTenant(tp.pg, A, (tx) => balance(tx, A))).toBe(1000);
  });
});

describe("BYOK lane — $0 wallet end-to-end (ADR-0182)", () => {
  test("a metered embed() on a BYOK lane records usage but never moves the wallet", async () => {
    await seed(1000);
    const model = mockEmbeddingModel([[0.9]], 10); // 10 in -> 1 credit actual

    const res = await embed("byok", "ping", baseOpts(model));

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
    const ledger = await tp.query(
      `SELECT 1 FROM credit_event
         WHERE account_id = $1 AND event_type IN ('feature_debit', 'feature_grant')`,
      [A],
    );
    expect(ledger).toHaveLength(0);
  });
});

describe("callId idempotency", () => {
  test("a retried embed() under the same callId settles exactly once", async () => {
    await seed(1000);
    const model = mockEmbeddingModel([[0.1]], 10);
    const callId = "fixed-call-id";

    const first = await embed("default", "x", baseOpts(model, { callId }));
    const second = await embed("default", "x", baseOpts(model, { callId }));

    expect(second.reconciled.idempotent).toBe(true);
    expect(first.reconciled.actualCredits).toBe(
      second.reconciled.actualCredits,
    );
    const rows = await tp.query(
      `SELECT 1 FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1`,
      [A],
    );
    expect(rows).toHaveLength(1); // settled once despite two calls
  });
});

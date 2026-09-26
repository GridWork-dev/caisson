import { afterAll, describe, expect, test } from "bun:test";
import {
  CREDIT_EXPIRY_MIGRATION_SQL,
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
  GRANT_CONSUMPTION_MIGRATION_SQL,
  balance,
  grant,
} from "@caisson-sh/credits";
import {
  AI_METER_SCHEMA_SQL,
  SPEND_POLICY_TABLE,
  USAGE_EVENT_TABLE,
} from "@caisson-sh/ai-meter";
import type { MeterConfig, Usage } from "@caisson-sh/ai-meter";
import type { AiSettings } from "@caisson-sh/ai-config";
import { localModerator } from "@caisson-sh/guardrails";
import {
  InMemoryEventSink,
  asCredits,
  asMicroUsdPerCredit,
} from "@caisson-sh/kernel";
import { matchGolden, newTestPg, type TestPg } from "@caisson-sh/testing";
import { withTenant } from "@caisson-sh/tenancy-rls";
import { simulateReadableStream } from "ai";
import { MockEmbeddingModelV4, MockLanguageModelV4 } from "ai/test";
import type {
  LanguageModelV4,
  LanguageModelV4StreamPart,
  LanguageModelV4Usage,
} from "@ai-sdk/provider";
import { embed, type EmbedOptions } from "./embed.ts";
import {
  infer,
  inferStream,
  type InferOptions,
  type InferStreamOptions,
} from "./gateway.ts";
import {
  canPersistUsage,
  normalizeEmbeddingUsage,
  normalizeLanguageUsage,
} from "./usage.ts";

describe("normalizeLanguageUsage", () => {
  test("normalizes legacy flat usage without exposing an SDK type", () => {
    expect(
      normalizeLanguageUsage({
        inputTokens: 10,
        outputTokens: 20,
        cachedInputTokens: 3,
      }),
    ).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      cachedInputTokens: 3,
    });
  });

  test("prefers a valid nested cache-read count", () => {
    expect(
      normalizeLanguageUsage({
        inputTokens: 12,
        outputTokens: 4,
        cachedInputTokens: 2,
        inputTokenDetails: { cacheReadTokens: 8 },
      }),
    ).toEqual({
      inputTokens: 12,
      outputTokens: 4,
      cachedInputTokens: 8,
    });
  });

  test("treats partial, fractional, malformed, or out-of-range primary counts as unreported", () => {
    for (const usage of [
      { inputTokens: undefined, outputTokens: 2 },
      { inputTokens: 2, outputTokens: undefined },
      { inputTokens: 1.5, outputTokens: 2 },
      { inputTokens: -1, outputTokens: 2 },
      { inputTokens: 1, outputTokens: Number.POSITIVE_INFINITY },
      { inputTokens: Number.NaN, outputTokens: 2 },
      { inputTokens: 2_147_483_648, outputTokens: 2 },
    ]) {
      expect(normalizeLanguageUsage(usage)).toBeNull();
    }
  });

  test("does not discount malformed cache-read usage", () => {
    for (const cacheReadTokens of [11, 1.5, Number.NaN]) {
      expect(
        normalizeLanguageUsage({
          inputTokens: 10,
          outputTokens: 2,
          inputTokenDetails: { cacheReadTokens },
        }),
      ).toEqual({
        inputTokens: 10,
        outputTokens: 2,
        cachedInputTokens: 0,
      });
    }
  });

  test("keeps unreported usage distinct from a reported zero", () => {
    expect(normalizeLanguageUsage({})).toBeNull();
    expect(normalizeLanguageUsage({ inputTokens: 0, outputTokens: 0 })).toEqual(
      {
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
      },
    );
  });
});

describe("normalizeEmbeddingUsage", () => {
  test("normalizes a reported token count as input-only usage", () => {
    expect(normalizeEmbeddingUsage({ tokens: 10 }, ["ignored"])).toEqual({
      inputTokens: 10,
      outputTokens: 0,
      cachedInputTokens: 0,
    });
  });

  test("falls back to deterministic input estimates for invalid usage", () => {
    expect(
      normalizeEmbeddingUsage({ tokens: Number.NaN }, ["12345", "123456789"]),
    ).toEqual({
      inputTokens: 5,
      outputTokens: 0,
      cachedInputTokens: 0,
    });
    expect(normalizeEmbeddingUsage({ tokens: 10.9 }, ["12345"])).toEqual({
      inputTokens: 2,
      outputTokens: 0,
      cachedInputTokens: 0,
    });
  });

  test("falls back when a reported count is negative or outside the ledger range", () => {
    expect(normalizeEmbeddingUsage({ tokens: -3 }, ["12345"])).toEqual({
      inputTokens: 2,
      outputTokens: 0,
      cachedInputTokens: 0,
    });
    expect(
      normalizeEmbeddingUsage({ tokens: 2_147_483_648 }, ["12345"]),
    ).toEqual({
      inputTokens: 2,
      outputTokens: 0,
      cachedInputTokens: 0,
    });
  });
});

describe("canPersistUsage", () => {
  test("rejects derived money values that exceed PostgreSQL integer columns", () => {
    const meter: MeterConfig = {
      priceBook: {
        "openai/model": {
          inputPerMTok: 1_000_000,
          cachedInputPerMTok: 500_000,
          outputPerMTok: 15_000_000,
        },
      },
      conversion: { microUsdPerCredit: asMicroUsdPerCredit(100) },
    };

    expect(
      canPersistUsage(
        {
          inputTokens: 1,
          outputTokens: 143_165_577,
          cachedInputTokens: 0,
        },
        "openai",
        "model",
        meter,
      ),
    ).toBe(false);
    expect(
      canPersistUsage(
        { inputTokens: 10, outputTokens: 20, cachedInputTokens: 2 },
        "openai",
        "model",
        meter,
      ),
    ).toBe(true);
  });
});

interface UsageGolden {
  readonly generateReported: {
    readonly usage: Usage;
    readonly actualCredits: number;
    readonly ledgerRows: number;
  };
  readonly generateCached: {
    readonly usage: Usage;
    readonly actualCredits: number;
    readonly ledgerRows: number;
  };
  readonly generateZero: {
    readonly usage: Usage;
    readonly refundedCredits: number;
    readonly ledgerRows: number;
  };
  readonly generateUnreported: {
    readonly actualEqualsReserved: boolean;
    readonly refundedCredits: number;
  };
  readonly generateFailed: {
    readonly chargedCredits: number;
    readonly leakedReservation: boolean;
  };
  readonly streamFinished: {
    readonly usage: Usage;
    readonly actualCredits: number;
    readonly ledgerRows: number;
  };
  readonly streamAbandoned: {
    readonly usedEstimate: boolean;
    readonly ledgerRows: number;
    readonly leakedReservation: boolean;
  };
  readonly embedding: {
    readonly usage: Usage;
    readonly outputCredits: number;
    readonly actualCredits: number;
  };
}

const ACCOUNT_ID = "acct_usage_golden";

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

const METER: MeterConfig = {
  priceBook: {
    "openai/model": {
      inputPerMTok: 1_000_000,
      cachedInputPerMTok: 500_000,
      outputPerMTok: 2_000_000,
    },
  },
  conversion: { microUsdPerCredit: asMicroUsdPerCredit(100) },
  now: new Date("2026-07-13T12:00:00Z"),
};

let tp: TestPg | undefined;

interface TestLanguageUsage {
  readonly inputTokens: number | undefined;
  readonly outputTokens: number | undefined;
  readonly totalTokens: number | undefined;
  readonly cachedInputTokens?: number;
}

function sdkUsage(usage: TestLanguageUsage): LanguageModelV4Usage {
  const cachedInputTokens = usage.cachedInputTokens ?? 0;
  return {
    inputTokens: {
      total: usage.inputTokens,
      noCache:
        usage.inputTokens === undefined
          ? undefined
          : Math.max(0, usage.inputTokens - cachedInputTokens),
      cacheRead:
        usage.inputTokens === undefined ? undefined : cachedInputTokens,
      cacheWrite: 0,
    },
    outputTokens: {
      total: usage.outputTokens,
      text: usage.outputTokens,
      reasoning: 0,
    },
  };
}

function testPg(): TestPg {
  if (tp === undefined) throw new Error("usage golden database is not open");
  return tp;
}

async function resetSchema(): Promise<void> {
  if (tp === undefined) tp = await newTestPg();
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
      .map((table) => `DROP TABLE IF EXISTS ${table} CASCADE;`)
      .join("\n"),
  );
  await tp.exec(CREDIT_SCHEMA_SQL);
  await tp.exec(CREDIT_ROUNDING_MIGRATION_SQL);
  await tp.exec(CREDIT_EXPIRY_MIGRATION_SQL);
  await tp.exec(GRANT_CONSUMPTION_MIGRATION_SQL);
  await tp.exec(AI_METER_SCHEMA_SQL);
  await withTenant(tp.pg, ACCOUNT_ID, (tx) =>
    grant(tx, {
      accountId: ACCOUNT_ID,
      amount: asCredits(1_000),
      eventType: "purchase",
      sourceEventId: "usage-golden-seed",
    }),
  );
}

function languageModel(
  usage: TestLanguageUsage,
  text = "ok",
): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      finishReason: { unified: "stop", raw: "stop" },
      usage: sdkUsage(usage),
      content: [{ type: "text", text }],
      warnings: [],
    }),
  });
}

function failingLanguageModel(): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async () => {
      throw new Error("provider down");
    },
  });
}

function streamingModel(
  chunks: readonly string[],
  usage: TestLanguageUsage,
): MockLanguageModelV4 {
  const parts: LanguageModelV4StreamPart[] = [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "usage-golden" },
    ...chunks.map((delta): LanguageModelV4StreamPart => ({
      type: "text-delta",
      id: "usage-golden",
      delta,
    })),
    { type: "text-end", id: "usage-golden" },
    {
      type: "finish",
      finishReason: { unified: "stop", raw: "stop" },
      usage: sdkUsage(usage),
    },
  ];
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({ chunks: parts }),
    }),
  });
}

function inferOptions(model: LanguageModelV4): InferOptions {
  return {
    tx: testPg().pg,
    accountId: ACCOUNT_ID,
    settings: SETTINGS,
    resolveModel: () => model,
    guard: {
      policy: { policyName: "usage-golden", moderator: localModerator([]) },
      runtime: { tenantId: ACCOUNT_ID, sink: new InMemoryEventSink() },
    },
    meter: METER,
    maxOutputTokens: 50,
  };
}

function streamOptions(model: LanguageModelV4): InferStreamOptions {
  return inferOptions(model);
}

function embedOptions(model: MockEmbeddingModelV4): EmbedOptions {
  return {
    tx: testPg().pg,
    accountId: ACCOUNT_ID,
    settings: SETTINGS,
    resolveModel: () => model,
    meter: METER,
  };
}

async function usageCredits(): Promise<number[]> {
  const rows = await testPg().query<{ credits: number }>(
    `SELECT credits FROM ${USAGE_EVENT_TABLE} WHERE account_id = $1 ORDER BY created_at`,
    [ACCOUNT_ID],
  );
  return rows.map((row) => row.credits);
}

async function walletBalance(): Promise<number> {
  return withTenant(testPg().pg, ACCOUNT_ID, (tx) => balance(tx, ACCOUNT_ID));
}

afterAll(async () => {
  await tp?.close();
});

describe("SDK usage-accounting golden", () => {
  test("pins integer ledger outcomes across every migration-sensitive path", async () => {
    await resetSchema();
    const reported = await infer(
      "default",
      { messages: [{ role: "user", content: "ping" }] },
      inferOptions(
        languageModel({
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
        }),
      ),
    );
    const reportedRows = await usageCredits();

    await resetSchema();
    const cached = await infer(
      "default",
      { messages: [{ role: "user", content: "cached" }] },
      inferOptions(
        languageModel({
          inputTokens: 200,
          outputTokens: 0,
          totalTokens: 200,
          cachedInputTokens: 200,
        }),
      ),
    );
    const cachedRows = await usageCredits();

    await resetSchema();
    const zero = await infer(
      "default",
      { messages: [{ role: "user", content: "zero" }] },
      inferOptions(
        languageModel({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
      ),
    );
    const zeroRows = await usageCredits();

    await resetSchema();
    const unreported = await infer(
      "default",
      { messages: [{ role: "user", content: "unreported" }] },
      inferOptions(
        languageModel({
          inputTokens: undefined,
          outputTokens: undefined,
          totalTokens: undefined,
        }),
      ),
    );

    await resetSchema();
    await expect(
      infer(
        "default",
        { messages: [{ role: "user", content: "failed" }] },
        inferOptions(failingLanguageModel()),
      ),
    ).rejects.toThrow("provider down");
    const failedRows = await usageCredits();
    const failedBalance = await walletBalance();

    await resetSchema();
    const finishedStream = await inferStream(
      "default",
      { messages: [{ role: "user", content: "stream" }] },
      streamOptions(
        streamingModel(["hello", " world"], {
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
        }),
      ),
    );
    for await (const _delta of finishedStream.textStream) {
      // Drain through the provider finish part so the reported total becomes authoritative.
    }
    const finished = await finishedStream.settled;
    const finishedRows = await usageCredits();

    await resetSchema();
    const abandonedStream = await inferStream(
      "default",
      { messages: [{ role: "user", content: "stream" }] },
      streamOptions(
        streamingModel(["partial", " ignored"], {
          inputTokens: 9_000,
          outputTokens: 9_000,
          totalTokens: 18_000,
        }),
      ),
    );
    for await (const _delta of abandonedStream.textStream) break;
    const abandoned = await abandonedStream.settled;
    const abandonedRows = await usageCredits();
    const abandonedBalance = await walletBalance();

    await resetSchema();
    const embedding = await embed(
      "default",
      "embedding input",
      embedOptions(
        new MockEmbeddingModelV4({
          maxEmbeddingsPerCall: Infinity,
          doEmbed: async () => ({
            embeddings: [[0.1, 0.2]],
            usage: { tokens: 10 },
            warnings: [],
          }),
        }),
      ),
    );

    const golden: UsageGolden = {
      generateReported: {
        usage: reported.usage,
        actualCredits: reported.reconciled.actualCredits,
        ledgerRows: reportedRows.length,
      },
      generateCached: {
        usage: cached.usage,
        actualCredits: cached.reconciled.actualCredits,
        ledgerRows: cachedRows.length,
      },
      generateZero: {
        usage: zero.usage,
        refundedCredits: zero.reconciled.refundedCredits,
        ledgerRows: zeroRows.length,
      },
      generateUnreported: {
        actualEqualsReserved:
          unreported.reconciled.actualCredits ===
          unreported.reserved.reservedCredits,
        refundedCredits: unreported.reconciled.refundedCredits,
      },
      generateFailed: {
        chargedCredits: failedRows.reduce((sum, credits) => sum + credits, 0),
        leakedReservation: failedBalance !== 1_000,
      },
      streamFinished: {
        usage: finished.usage,
        actualCredits: finished.reconciled.actualCredits,
        ledgerRows: finishedRows.length,
      },
      streamAbandoned: {
        usedEstimate:
          abandoned.abandoned &&
          abandoned.usage.outputTokens < 9_000 &&
          abandoned.usage.outputTokens > 0,
        ledgerRows: abandonedRows.length,
        leakedReservation:
          abandonedBalance !== 1_000 - abandoned.reconciled.actualCredits,
      },
      embedding: {
        usage: embedding.usage,
        outputCredits: embedding.usage.outputTokens,
        actualCredits: embedding.reconciled.actualCredits,
      },
    };

    matchGolden(import.meta.url, "usage-accounting", golden);
  });
});

// Golden parity for the ai-meter poke's mirror (ADR-0378 lock 2): every constant + pure function in
// ai-meter-logic.ts must be byte/number-identical to the real @caisson/ai-meter package AND to the
// shipped packages/ai-meter/src/__golden__/cost.json fixture. This test imports the real package
// directly - it runs under bun (node:crypto, @caisson/tenancy-rls, @caisson/credits all resolve
// fine here), unlike the browser bundle the poke component ships in.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  BUNDLED_PRICE_BOOK as REAL_PRICE_BOOK,
  CREDIT_CONVERSION,
  PRICE_BOOK_VERSION as REAL_PRICE_BOOK_VERSION,
  CHARS_PER_TOKEN as REAL_CHARS_PER_TOKEN,
  DEFAULT_OUTPUT_TOKENS as REAL_DEFAULT_OUTPUT_TOKENS,
  SpendCapError,
  computeCost as realComputeCost,
  creditsForMicroUsd as realCreditsForMicroUsd,
  estimateTokens as realEstimateTokens,
  estimateUsage as realEstimateUsage,
  priceKey as realPriceKey,
  resolvePriceEntry as realResolvePriceEntry,
} from "@caisson/ai-meter";

import {
  BUNDLED_PRICE_BOOK,
  CHARS_PER_TOKEN,
  DEFAULT_OUTPUT_TOKENS,
  GOLDEN_USAGE,
  MICRO_USD_PER_CREDIT,
  MODEL_KEYS,
  PRICE_BOOK_VERSION,
  SpendCapErrorMirror,
  computeCost,
  creditsForMicroUsd,
  estimateTokens,
  estimateUsage,
  initSession,
  priceKey,
  reconcileStep,
  reserveStep,
  resetBreakerStep,
  resolvePriceEntry,
  runaway,
  type ModelKey,
} from "./ai-meter-logic";

describe("constant parity vs the real package", () => {
  test("PRICE_BOOK_VERSION matches", () => {
    expect(PRICE_BOOK_VERSION).toBe(REAL_PRICE_BOOK_VERSION);
  });

  test("BUNDLED_PRICE_BOOK is byte-identical", () => {
    expect(REAL_PRICE_BOOK).toEqual(BUNDLED_PRICE_BOOK);
  });

  test("MICRO_USD_PER_CREDIT matches the real credit denomination", () => {
    expect(MICRO_USD_PER_CREDIT).toBe(CREDIT_CONVERSION.microUsdPerCredit);
  });

  test("CHARS_PER_TOKEN and DEFAULT_OUTPUT_TOKENS match", () => {
    expect(CHARS_PER_TOKEN).toBe(REAL_CHARS_PER_TOKEN);
    expect(DEFAULT_OUTPUT_TOKENS).toBe(REAL_DEFAULT_OUTPUT_TOKENS);
  });
});

describe("priceKey + resolvePriceEntry parity", () => {
  test("priceKey matches for every bundled model", () => {
    for (const key of MODEL_KEYS) {
      const [provider, ...rest] = key.split("/");
      const model = rest.join("/");
      expect(priceKey(provider ?? "", model)).toBe(
        realPriceKey(provider ?? "", model),
      );
      expect(priceKey(provider ?? "", model)).toBe(key);
    }
  });

  test("resolvePriceEntry returns the real entry for every bundled model", () => {
    for (const key of MODEL_KEYS) {
      const [provider, ...rest] = key.split("/");
      const model = rest.join("/");
      expect(resolvePriceEntry(key)).toEqual(
        realResolvePriceEntry(REAL_PRICE_BOOK, provider ?? "", model),
      );
    }
  });

  test("resolvePriceEntry fails closed on an unknown model, mirroring ConfigError's throw", () => {
    expect(() => resolvePriceEntry("nope/nope" as ModelKey)).toThrow();
    expect(() =>
      realResolvePriceEntry(REAL_PRICE_BOOK, "nope", "nope"),
    ).toThrow();
  });
});

describe("estimateTokens + estimateUsage parity", () => {
  const samples = [
    "",
    "a",
    "x".repeat(2000),
    "y".repeat(7999),
    "z".repeat(8000),
  ];

  test("estimateTokens matches for every sample", () => {
    for (const text of samples) {
      expect(estimateTokens(text)).toBe(realEstimateTokens(text));
    }
  });

  test("estimateUsage matches for every sample, with and without a maxOutputTokens cap", () => {
    for (const text of samples) {
      const messages = [{ role: "user", content: text }];
      expect(estimateUsage(messages)).toEqual(realEstimateUsage(messages));
      expect(estimateUsage(messages, 256)).toEqual(
        realEstimateUsage(messages, 256),
      );
    }
  });
});

describe("computeCost + creditsForMicroUsd parity against the golden fixture (BLESS unset)", () => {
  const goldenSchema = z.object({
    creditConversion: z.object({
      microUsdPerCredit: z.number().int().positive(),
    }),
    priceBook: z.record(
      z.string(),
      z.object({
        inputPerMTok: z.number().int(),
        cachedInputPerMTok: z.number().int(),
        outputPerMTok: z.number().int(),
      }),
    ),
    cases: z.array(
      z.object({
        name: z.string(),
        provider: z.string(),
        model: z.string(),
        usage: z.object({
          inputTokens: z.number().int(),
          cachedInputTokens: z.number().int(),
          outputTokens: z.number().int(),
        }),
        expected: z.object({
          costMicroUsd: z.number().int(),
          credits: z.number().int(),
        }),
      }),
    ),
  });

  const golden = goldenSchema.parse(
    JSON.parse(
      readFileSync(
        // packages/ai-meter/src/__golden__/cost.json, resolved from this file's own directory
        // (apps/site/components/poke/) so a glob-guessed path can never silently drift.
        join(
          import.meta.dir,
          "..",
          "..",
          "..",
          "..",
          "packages",
          "ai-meter",
          "src",
          "__golden__",
          "cost.json",
        ),
        "utf8",
      ),
    ),
  );

  expect(golden.creditConversion.microUsdPerCredit).toBe(MICRO_USD_PER_CREDIT);

  for (const c of golden.cases) {
    test(`${c.name}: mirror matches fixture and the real package`, () => {
      const key = priceKey(c.provider, c.model);
      const mirrorEntry = BUNDLED_PRICE_BOOK[key as ModelKey];
      expect(mirrorEntry).toBeDefined();
      if (mirrorEntry === undefined) return;

      const mirrorCost = computeCost(c.usage, mirrorEntry);
      expect(mirrorCost.costMicroUsd).toBe(c.expected.costMicroUsd);
      expect(mirrorCost.credits).toBe(c.expected.credits);
      expect(creditsForMicroUsd(mirrorCost.costMicroUsd)).toBe(
        c.expected.credits,
      );

      const realEntry = golden.priceBook[key];
      expect(realEntry).toBeDefined();
      if (realEntry === undefined) return;
      const realCost = realComputeCost(c.usage, realEntry, CREDIT_CONVERSION);
      expect(mirrorCost.costMicroUsd).toBe(realCost.costMicroUsd);
      expect(mirrorCost.credits).toBe(realCost.credits);
      expect(c.expected.credits).toBe(
        realCreditsForMicroUsd(mirrorCost.costMicroUsd, CREDIT_CONVERSION),
      );
    });
  }

  test("the poke's GOLDEN_USAGE constant is the fixture's openai-partial-cache case", () => {
    const fixtureCase = golden.cases.find(
      (c) => c.name === "openai-partial-cache",
    );
    expect(fixtureCase).toBeDefined();
    if (fixtureCase === undefined) return;
    expect(GOLDEN_USAGE).toEqual(fixtureCase.usage);

    const entry = BUNDLED_PRICE_BOOK["openai/gpt-4o-mini"];
    const cost = computeCost(GOLDEN_USAGE, entry);
    expect(cost.costMicroUsd).toBe(1680);
    expect(cost.credits).toBe(2);
    expect(cost).toEqual({
      costMicroUsd: fixtureCase.expected.costMicroUsd,
      credits: fixtureCase.expected.credits,
    });

    const realCost = realComputeCost(
      GOLDEN_USAGE,
      realResolvePriceEntry(REAL_PRICE_BOOK, "openai", "gpt-4o-mini"),
      CREDIT_CONVERSION,
    );
    expect(cost.costMicroUsd).toBe(realCost.costMicroUsd);
    expect(cost.credits).toBe(realCost.credits);
  });
});

describe("SpendCapErrorMirror parity vs the real SpendCapError", () => {
  test("code, httpStatus, and default message match", () => {
    const real = new SpendCapError("account");
    const mirror = new SpendCapErrorMirror("account");
    expect(mirror.code).toBe(real.code);
    expect(mirror.httpStatus).toBe(real.httpStatus);
    expect(mirror.message).toBe(real.message);
  });
});

describe("session replay: reserve -> reconcile -> runaway -> reset (runnable self-check)", () => {
  test("debit-before-spend: reserve lands a feature_debit ledger row before any usage is metered", () => {
    const session = initSession(500, 5, 3);
    const { session: next, result } = reserveStep(
      session,
      "openai/gpt-4o-mini",
      2000,
    );
    expect(result.reservedCredits).toBeGreaterThan(0);
    expect(next.wallet).toBe(500 - result.reservedCredits);
    expect(next.ledger[0]?.kind).toBe("feature_debit");
    expect(next.ledger[0]?.credits).toBe(result.reservedCredits);
  });

  test("reconcile with nothing pending returns null", () => {
    const session = initSession(500, 5, 3);
    expect(reconcileStep(session)).toBeNull();
  });

  test("reconcile trues up to the golden actual and settles idempotently on a second call", () => {
    const session = initSession(500, 50, 30);
    const { session: reserved } = reserveStep(
      session,
      "openai/gpt-4o-mini",
      2000,
    );
    const first = reconcileStep(reserved);
    expect(first).not.toBeNull();
    if (first === null) return;
    expect(first.result.idempotent).toBe(false);
    expect(first.result.actualCredits).toBe(2);

    const second = reconcileStep(first.session);
    expect(second).not.toBeNull();
    if (second === null) return;
    expect(second.result.idempotent).toBe(true);
    // Idempotent replay settles once - no second ledger row, no second wallet move.
    expect(second.session.wallet).toBe(first.session.wallet);
    expect(second.session.ledger.length).toBe(first.session.ledger.length);
  });

  test("runaway trips the breaker exactly when spend crosses the hard cap, then blocks the next reserve", () => {
    const session = initSession(500, 5, 3);
    const { session: next, outcome } = runaway(
      session,
      "openai/gpt-4o-mini",
      2000,
    );
    expect(outcome.trippedAtIteration).not.toBeNull();
    expect(next.breaker).toBe("open");
    expect(outcome.blocked).not.toBeNull();
    expect(outcome.blocked?.code).toBe("spend_cap_reached");
    expect(outcome.blocked?.httpStatus).toBe(402);

    // The breaker is open: a plain reserveStep call now throws (never a silent charge).
    expect(() => reserveStep(next, "openai/gpt-4o-mini", 2000)).toThrow(
      SpendCapErrorMirror,
    );
  });

  test("resetBreakerStep closes the breaker so reserves resume", () => {
    const session = initSession(500, 5, 3);
    const { session: tripped } = runaway(session, "openai/gpt-4o-mini", 2000);
    expect(tripped.breaker).toBe("open");
    const reset = resetBreakerStep(tripped);
    expect(reset.breaker).toBe("closed");
    expect(() => reserveStep(reset, "openai/gpt-4o-mini", 2000)).not.toThrow();
  });
});

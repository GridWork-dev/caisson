// Price-book cost golden (ADR-0060/0013): `computeCost` normalizes each per-provider usage shape
// to the EXACT integer micro-USD + credit units pinned in `__golden__/cost.json`. The fixture is a
// fixed data table (BLESS unset here) — it never regenerates, so a rounding or
// accounting drift fails this test. Pure, no DB, no network.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { asMicroUsdPerCredit } from "@caisson-sh/kernel";
import {
  BUNDLED_PRICE_BOOK,
  computeCost,
  priceKey,
  resolvePriceEntry,
} from "./token-rates.ts";

const entrySchema = z.object({
  inputPerMTok: z.number().int(),
  cachedInputPerMTok: z.number().int(),
  outputPerMTok: z.number().int(),
});
const goldenSchema = z.object({
  creditConversion: z.object({
    microUsdPerCredit: z.number().int().positive(),
  }),
  priceBook: z.record(z.string(), entrySchema),
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
    readFileSync(join(import.meta.dir, "__golden__", "cost.json"), "utf8"),
  ),
);

// Mint the branded denomination (ADR-0212) from the golden's plain integer — same runtime value.
const conversion = {
  microUsdPerCredit: asMicroUsdPerCredit(
    golden.creditConversion.microUsdPerCredit,
  ),
};

describe("price-book cost golden (BLESS unset)", () => {
  for (const c of golden.cases) {
    test(c.name, () => {
      const entry = golden.priceBook[priceKey(c.provider, c.model)];
      expect(entry).toBeDefined();
      if (entry === undefined) return;
      const cost = computeCost(c.usage, entry, conversion);
      expect<number>(cost.costMicroUsd).toBe(c.expected.costMicroUsd);
      expect<number>(cost.credits).toBe(c.expected.credits);
      // ADR-0212: the rounding record mirrors the pinned pair — raw is the micro-USD cost, the
      // direction is this book's fixed "up", the result is the pinned credit charge.
      expect<unknown>(cost.roundingCredits).toEqual({
        raw: c.expected.costMicroUsd,
        mode: "up",
        result: c.expected.credits,
      });
    });
  }
});

describe("BUNDLED_PRICE_BOOK anthropic/claude-sonnet-4.5", () => {
  test("resolves instead of throwing ConfigError", () => {
    expect(() =>
      resolvePriceEntry(BUNDLED_PRICE_BOOK, "anthropic", "claude-sonnet-4.5"),
    ).not.toThrow();
  });

  test("meters a usage event at the verified $3 / $15 per-MTok rates", () => {
    const entry = resolvePriceEntry(
      BUNDLED_PRICE_BOOK,
      "anthropic",
      "claude-sonnet-4.5",
    );
    const usage = {
      inputTokens: 1_000_000,
      cachedInputTokens: 0,
      outputTokens: 1_000_000,
    };
    expect(() => computeCost(usage, entry, conversion)).not.toThrow();
    const cost = computeCost(usage, entry, conversion);
    // $3.00 input + $15.00 output per 1M tokens = $18.00 = 18,000,000 micro-USD.
    expect<number>(cost.costMicroUsd).toBe(18_000_000);
  });
});

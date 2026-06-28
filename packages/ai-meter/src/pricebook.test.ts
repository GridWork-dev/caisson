// T6 price-book cost golden (ADR-0060/0013): `computeCost` normalizes each per-provider usage shape
// to the EXACT integer micro-USD + credit units pinned in `__golden__/cost.json`. The fixture is a
// fixed data table (committed by T6, BLESS unset here) — it never regenerates, so a rounding or
// accounting drift fails this test. Pure, no DB, no network.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { computeCost, priceKey } from "./pricebook.ts";

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

describe("T6 price-book cost golden (BLESS unset)", () => {
  for (const c of golden.cases) {
    test(c.name, () => {
      const entry = golden.priceBook[priceKey(c.provider, c.model)];
      expect(entry).toBeDefined();
      if (entry === undefined) return;
      const cost = computeCost(c.usage, entry, golden.creditConversion);
      expect(cost.costMicroUsd).toBe(c.expected.costMicroUsd);
      expect(cost.credits).toBe(c.expected.credits);
    });
  }
});

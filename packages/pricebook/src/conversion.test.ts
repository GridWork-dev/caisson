// pricebook conversion + plan golden (ADR-0089/0013). Pins the shared denomination, the cents->credits
// GRANT conversion (round-DOWN), and the (placeholder) plan rows so a refactor that perturbs the unit
// OR silently edits a plan WITHOUT bumping PRICEBOOK_VERSION fails here. The fixture is fixed data
// (BLESS unset) — re-bless deliberately when the operator locks the final numbers. Pure, no DB/network.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ValidationError } from "@caisson/kernel";
import { CREDIT_CONVERSION, centsToCredits } from "./conversion.ts";
import { PLAN_BOOK, PRICEBOOK_VERSION, resolvePlan } from "./plans.ts";

const goldenSchema = z.object({
  pricebookVersion: z.string(),
  creditConversion: z.object({
    microUsdPerCredit: z.number().int().positive(),
  }),
  plans: z.record(
    z.string(),
    z.object({
      planTag: z.string(),
      creditsPerCycle: z.number().int().positive(),
      cadence: z.enum(["month", "year"]),
      entitlements: z.array(z.string()),
    }),
  ),
  centsToCredits: z.array(
    z.object({ cents: z.number().int(), credits: z.number().int() }),
  ),
});

const golden = goldenSchema.parse(
  JSON.parse(
    readFileSync(
      join(import.meta.dir, "__golden__", "conversion.json"),
      "utf8",
    ),
  ),
);

describe("pricebook conversion + plan golden (BLESS unset)", () => {
  test("the denomination matches the pinned unit", () => {
    expect(CREDIT_CONVERSION).toEqual(golden.creditConversion);
  });
  test("PRICEBOOK_VERSION matches the pinned stamp", () => {
    expect(PRICEBOOK_VERSION).toBe(golden.pricebookVersion);
  });
  test("the plan-book matches the pinned rows", () => {
    expect(PLAN_BOOK).toEqual(golden.plans);
  });
  for (const c of golden.centsToCredits) {
    test(`centsToCredits(${c.cents}) = ${c.credits} (round-down grant)`, () => {
      expect(centsToCredits(c.cents)).toBe(c.credits);
    });
  }
  test("resolvePlan returns the pinned entry for each plan id", () => {
    for (const [priceId, entry] of Object.entries(golden.plans)) {
      expect(resolvePlan(priceId)).toEqual(entry);
    }
  });
  test("centsToCredits rejects a fractional or negative amount", () => {
    expect(() => centsToCredits(1.5)).toThrow(ValidationError);
    expect(() => centsToCredits(-1)).toThrow(ValidationError);
  });
});

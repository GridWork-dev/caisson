// The single credit denomination + cents→credits GRANT conversion (ADR-0089/0098). Round-DOWN is the
// conservative grant direction (never over-grant); a fractional/negative amount fails loudly. Pure.
import { describe, expect, test } from "bun:test";
import { ValidationError } from "./errors.ts";
import { asMicroUsdPerCredit, type RoundedMoney } from "./money.ts";
import {
  CREDIT_CONVERSION,
  centsToCredits,
  centsToCreditsProvenance,
  parseCreditConversion,
} from "./credit-conversion.ts";

describe("credit denomination", () => {
  test("the canonical unit is 1 credit = 1000 micro-USD", () => {
    expect<number>(CREDIT_CONVERSION.microUsdPerCredit).toBe(1000);
  });
});

describe("centsToCredits (round-down grant)", () => {
  test("1 cent = 10 credits at the default unit", () => {
    expect<number>(centsToCredits(1)).toBe(10);
  });
  test("0 cents = 0 credits", () => {
    expect<number>(centsToCredits(0)).toBe(0);
  });
  test("$129.00 = 129_000 credits", () => {
    expect<number>(centsToCredits(12900)).toBe(129000);
  });
  test("rounds DOWN under a coarser unit (never over-grant)", () => {
    // floor(1 cent × 10_000 ÷ 3000) = floor(3.33) = 3
    expect<number>(
      centsToCredits(1, { microUsdPerCredit: asMicroUsdPerCredit(3000) }),
    ).toBe(3);
  });
  test("rejects a fractional amount", () => {
    expect(() => centsToCredits(1.5)).toThrow(ValidationError);
  });
  test("rejects a negative amount", () => {
    expect(() => centsToCredits(-1)).toThrow(ValidationError);
  });
});

describe("centsToCreditsProvenance (ADR-0212 rounding record)", () => {
  test("returns {raw, mode: down, result} matching centsToCredits", () => {
    expect<RoundedMoney>(centsToCreditsProvenance(12900)).toEqual({
      raw: 12900,
      mode: "down",
      result: 129000,
    });
  });
  test("records mode down even on an exact division", () => {
    expect<RoundedMoney>(centsToCreditsProvenance(1)).toEqual({
      raw: 1,
      mode: "down",
      result: 10,
    });
  });
  test("preserves the truncated raw under a coarser unit", () => {
    // floor(1 cent × 10_000 ÷ 3000) = 3 — the raw cents figure survives the truncation.
    expect<RoundedMoney>(
      centsToCreditsProvenance(1, {
        microUsdPerCredit: asMicroUsdPerCredit(3000),
      }),
    ).toEqual({
      raw: 1,
      mode: "down",
      result: 3,
    });
  });
  test("rejects a fractional amount (same guard as centsToCredits)", () => {
    expect(() => centsToCreditsProvenance(1.5)).toThrow(ValidationError);
  });
});

describe("parseCreditConversion (strict boundary)", () => {
  test("accepts a positive integer unit", () => {
    expect(
      parseCreditConversion({ microUsdPerCredit: 500 }).microUsdPerCredit,
    ).toBe(asMicroUsdPerCredit(500));
  });
  test("rejects zero / non-integer / unknown keys", () => {
    expect(() => parseCreditConversion({ microUsdPerCredit: 0 })).toThrow(
      ValidationError,
    );
    expect(() => parseCreditConversion({ microUsdPerCredit: 1.5 })).toThrow(
      ValidationError,
    );
    expect(() =>
      parseCreditConversion({ microUsdPerCredit: 1000, x: 1 }),
    ).toThrow(ValidationError);
  });
});

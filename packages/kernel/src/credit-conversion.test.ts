// The single credit denomination + cents→credits GRANT conversion (ADR-0089/0098). Round-DOWN is the
// conservative grant direction (never over-grant); a fractional/negative amount fails loudly. Pure.
import { describe, expect, test } from "bun:test";
import { ValidationError } from "./errors.ts";
import {
  CREDIT_CONVERSION,
  centsToCredits,
  parseCreditConversion,
} from "./credit-conversion.ts";

describe("credit denomination", () => {
  test("the canonical unit is 1 credit = 1000 micro-USD", () => {
    expect(CREDIT_CONVERSION.microUsdPerCredit).toBe(1000);
  });
});

describe("centsToCredits (round-down grant)", () => {
  test("1 cent = 10 credits at the default unit", () => {
    expect(centsToCredits(1)).toBe(10);
  });
  test("0 cents = 0 credits", () => {
    expect(centsToCredits(0)).toBe(0);
  });
  test("$129.00 = 129_000 credits", () => {
    expect(centsToCredits(12900)).toBe(129000);
  });
  test("rounds DOWN under a coarser unit (never over-grant)", () => {
    // floor(1 cent × 10_000 ÷ 3000) = floor(3.33) = 3
    expect(centsToCredits(1, { microUsdPerCredit: 3000 })).toBe(3);
  });
  test("rejects a fractional amount", () => {
    expect(() => centsToCredits(1.5)).toThrow(ValidationError);
  });
  test("rejects a negative amount", () => {
    expect(() => centsToCredits(-1)).toThrow(ValidationError);
  });
});

describe("parseCreditConversion (strict boundary)", () => {
  test("accepts a positive integer unit", () => {
    expect(
      parseCreditConversion({ microUsdPerCredit: 500 }).microUsdPerCredit,
    ).toBe(500);
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

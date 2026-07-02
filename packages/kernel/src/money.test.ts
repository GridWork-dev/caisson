// Branded money constructors (ADR-0212): mint on a valid integer, throw ValidationError on a
// fractional/negative/zero-where-positive input, and stay runtime-invisible (the branded value IS
// the number). Pure, no DB.
import { describe, expect, test } from "bun:test";
import { ValidationError } from "./errors.ts";
import {
  asCents,
  asCredits,
  asMicroUsd,
  asMicroUsdPerCredit,
  unwrapMoney,
} from "./money.ts";

describe("money constructors (non-negative integers)", () => {
  for (const [name, mint] of [
    ["asCents", asCents],
    ["asCredits", asCredits],
    ["asMicroUsd", asMicroUsd],
  ] as const) {
    test(`${name} mints 0 and a positive integer, runtime-identical`, () => {
      expect<number>(mint(0)).toBe(0);
      expect<number>(mint(12900)).toBe(12900);
    });
    test(`${name} rejects a fractional or negative amount`, () => {
      expect(() => mint(1.5)).toThrow(ValidationError);
      expect(() => mint(-1)).toThrow(ValidationError);
      expect(() => mint(Number.NaN)).toThrow(ValidationError);
    });
  }
});

describe("asMicroUsdPerCredit (positive integer — the denomination)", () => {
  test("mints a positive integer", () => {
    expect<number>(asMicroUsdPerCredit(1000)).toBe(1000);
  });
  test("rejects zero, fractional, and negative units", () => {
    expect(() => asMicroUsdPerCredit(0)).toThrow(ValidationError);
    expect(() => asMicroUsdPerCredit(1.5)).toThrow(ValidationError);
    expect(() => asMicroUsdPerCredit(-1000)).toThrow(ValidationError);
  });
});

describe("unwrapMoney (identity DB-boundary marker)", () => {
  test("returns the same number", () => {
    expect(unwrapMoney(asCredits(42))).toBe(42);
  });
});

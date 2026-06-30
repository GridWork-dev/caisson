// The one-time PURCHASE_BOOK (ADR-0113): resolvePurchase returns a placeholder entry, fails closed on
// an unknown / real provider id, and is prototype-pollution safe. Mirrors plans.test.ts for the
// recurring book.
import { describe, expect, test } from "bun:test";
import { ConfigError } from "@caisson/kernel";
import {
  PURCHASE_BOOK,
  parsePurchaseBook,
  resolvePurchase,
} from "./purchases.ts";

describe("resolvePurchase (ADR-0113, fail-closed)", () => {
  test("resolves a credit-pack placeholder (credits, no entitlement)", () => {
    const entry = resolvePurchase("price_credit_pack_PLACEHOLDER");
    expect(entry.credits).toBe(5000);
    expect(entry.entitlements).toEqual([]);
  });

  test("resolves a one-time edition placeholder (entitlement, no credit pack)", () => {
    const entry = resolvePurchase("price_compliance_onetime_PLACEHOLDER");
    expect(entry.credits).toBe(0);
    expect(entry.entitlements).toEqual(["compliance"]);
  });

  test("an unknown price id throws (never a guessed grant)", () => {
    expect(() => resolvePurchase("price_not_in_book")).toThrow(ConfigError);
  });

  test("an inherited key cannot bypass the fail-closed throw", () => {
    expect(() => resolvePurchase("__proto__")).toThrow(ConfigError);
    expect(() => resolvePurchase("constructor")).toThrow(ConfigError);
  });

  test("parsePurchaseBook rejects an unknown field (Zod .strict())", () => {
    expect(() =>
      parsePurchaseBook({
        price_x: {
          purchaseTag: "x",
          credits: 1,
          entitlements: [],
          bogus: true,
        },
      }),
    ).toThrow();
  });

  test("the shipped book parses against its own schema", () => {
    expect(() => parsePurchaseBook(PURCHASE_BOOK)).not.toThrow();
  });
});

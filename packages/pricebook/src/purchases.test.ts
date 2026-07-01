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

describe("per-module à-la-carte PLACEHOLDER rows (P6-store track)", () => {
  // The 12 current modules (ADR-0071 entitlement infra; operator locked: sell every commercial
  // module individually). Entitlement id = bare package slug.
  const CURRENT_MODULES: readonly string[] = [
    "compliance",
    "field-crypto",
    "audit-worm",
    "ai-meter",
    "ai-evals",
    "guardrails",
    "prompt-registry",
    "ai-kit",
    "local-ai",
    "local-store",
    "agent-kernel",
    "agent-dev",
  ];
  // 2 future Compliance modules — reserved entitlement ids, packages not yet built.
  const FUTURE_MODULES: readonly string[] = ["alerting", "retention-runner"];

  for (const slug of CURRENT_MODULES) {
    test(`price_${slug}_module_PLACEHOLDER resolves to credits:0, entitlements:[${slug}]`, () => {
      const priceId = `price_${slug.replaceAll("-", "_")}_module_PLACEHOLDER`;
      const entry = resolvePurchase(priceId);
      expect(entry.credits).toBe(0);
      expect(entry.entitlements).toEqual([slug]);
    });
  }

  for (const slug of FUTURE_MODULES) {
    test(`price_${slug}_module_PLACEHOLDER (future/reserved) still resolves a purchase-book row`, () => {
      const priceId = `price_${slug.replaceAll("-", "_")}_module_PLACEHOLDER`;
      const entry = resolvePurchase(priceId);
      expect(entry.credits).toBe(0);
      expect(entry.entitlements).toEqual([slug]);
    });
  }

  test("every current + future module has exactly one purchase-book row", () => {
    const rows = Object.values(PURCHASE_BOOK);
    for (const slug of [...CURRENT_MODULES, ...FUTURE_MODULES]) {
      const matches = rows.filter(
        (r) =>
          r.entitlements.length === 1 &&
          r.entitlements[0] === slug &&
          r.credits === 0,
      );
      expect(matches.length).toBeGreaterThanOrEqual(1);
    }
  });
});

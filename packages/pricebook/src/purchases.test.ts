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
    expect<number>(entry.credits).toBe(5000);
    expect(entry.entitlements).toEqual([]);
  });

  test("resolves the REAL credit-pack row the same way as the placeholder (module-SKU wiring, 2026-07-02)", () => {
    const entry = resolvePurchase("pri_01kwj71ae0g946ztm4sej7bq76");
    expect<number>(entry.credits).toBe(5000);
    expect(entry.entitlements).toEqual([]);
    expect(entry.purchaseTag).toBe("credit_pack");
  });

  test("resolves a one-time edition placeholder (entitlement, no credit pack)", () => {
    const entry = resolvePurchase("price_compliance_onetime_PLACEHOLDER");
    expect<number>(entry.credits).toBe(0);
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
  // The 13 current modules (ADR-0071 entitlement infra; operator locked: sell every commercial
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
    "agent-runner",
  ];
  // 2 future Compliance modules — reserved entitlement ids, packages not yet built.
  const FUTURE_MODULES: readonly string[] = ["alerting", "retention-runner"];

  for (const slug of CURRENT_MODULES) {
    test(`price_${slug}_module_PLACEHOLDER resolves to credits:0, entitlements:[${slug}]`, () => {
      const priceId = `price_${slug.replaceAll("-", "_")}_module_PLACEHOLDER`;
      const entry = resolvePurchase(priceId);
      expect<number>(entry.credits).toBe(0);
      expect(entry.entitlements).toEqual([slug]);
    });
  }

  for (const slug of FUTURE_MODULES) {
    test(`price_${slug}_module_PLACEHOLDER (future/reserved) still resolves a purchase-book row`, () => {
      const priceId = `price_${slug.replaceAll("-", "_")}_module_PLACEHOLDER`;
      const entry = resolvePurchase(priceId);
      expect<number>(entry.credits).toBe(0);
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

describe("per-module à-la-carte REAL rows (module-SKU wiring, 2026-07-02)", () => {
  // The 15 real sandbox `pri_…` ids Paddle issued for the à-la-carte module SKUs — mirrors the
  // edition/bundle REAL rows' pinning. `alerting`/`retention-runner` are no longer "future": both
  // shipped in Stage-2 (ADR-0150/0151) and are registry-indexed, so the module row resolves the
  // same way as every other current module. `agent-runner` (ADR-0186) postdates the other 14 and
  // has no matching PLACEHOLDER-section history — its PLACEHOLDER row was added in the same change.
  const REAL_MODULE_PRICE_IDS: Readonly<Record<string, string>> = {
    compliance: "pri_01kwj6m31fxw5vn532h5ft6780",
    "field-crypto": "pri_01kwj6m3cwez98t45jzwsqb250",
    "audit-worm": "pri_01kwj6m3mjq4rpv7918rhfhrhw",
    "retention-runner": "pri_01kwj6m3x1cw1k54tcdhsc6pgj",
    "ai-meter": "pri_01kwj6m45zeqyxgad3f32x1b30",
    "ai-evals": "pri_01kwj6m4d3npk8sszerx7fek7w",
    guardrails: "pri_01kwj6m4n105qe80fapw9sk5xc",
    "prompt-registry": "pri_01kwj6m4whyw1stbej2qk8q0bg",
    "ai-kit": "pri_01kwj6m55yagz7188qer0pa0cd",
    alerting: "pri_01kwj6m5da9ay3z85b6qwtjcpe",
    "local-ai": "pri_01kwj6m5mzyn76b8jkknmjndb4",
    "local-store": "pri_01kwj6m5w3s4fmvseap7zmp5yf",
    "agent-kernel": "pri_01kwj6m63qpt52489tq5a3v6q3",
    "agent-dev": "pri_01kwj6m6cbtsh6n5b1bxtb2j0k",
    "agent-runner": "pri_01kwj71a53hycbspsfv8pck5vc",
  };

  for (const [slug, priceId] of Object.entries(REAL_MODULE_PRICE_IDS)) {
    test(`${priceId} resolves to credits:0, entitlements:[${slug}]`, () => {
      const entry = resolvePurchase(priceId);
      expect<number>(entry.credits).toBe(0);
      expect(entry.entitlements).toEqual([slug]);
      expect(entry.purchaseTag).toBe(`${slug}_module`);
    });
  }

  test("every REAL module row has a matching PLACEHOLDER fixture row still in the book", () => {
    for (const slug of Object.keys(REAL_MODULE_PRICE_IDS)) {
      const placeholderId = `price_${slug.replaceAll("-", "_")}_module_PLACEHOLDER`;
      expect(Object.hasOwn(PURCHASE_BOOK, placeholderId)).toBe(true);
    }
  });
});

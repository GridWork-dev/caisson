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
  // The 11 standalone à-la-carte modules (ADR-0071 entitlement infra; ADR-0238 dropped the four
  // edition-core rows — `compliance`/`ai-kit`/`local-ai`/`agent-dev` module SKUs named their own
  // edition's entitlement id and expanded to the whole edition). Entitlement id = bare package slug.
  const CURRENT_MODULES: readonly string[] = [
    "field-crypto",
    "audit-worm",
    "ai-meter",
    "ai-evals",
    "guardrails",
    "prompt-registry",
    "local-store",
    "agent-kernel",
    "agent-runner",
  ];
  // Shipped in Stage-2 (ADR-0150/0151) — kept in their own list for the reserved-id history.
  const FUTURE_MODULES: readonly string[] = ["alerting", "retention-runner"];

  test("no purchase-book module row's entitlement names an edition id (ADR-0238 lint)", () => {
    // A module row granting an EDITION id would expand to the whole edition (the dropped-row bug).
    const editionIds = new Set([
      "compliance",
      "ai-kit",
      "local-ai",
      "agent-dev",
    ]);
    const offenders = Object.entries(PURCHASE_BOOK)
      .filter(([, row]) => row.purchaseTag.endsWith("_module"))
      .filter(([, row]) =>
        row.entitlements.some((slug) => editionIds.has(slug)),
      )
      .map(([priceId]) => priceId);
    expect(offenders).toEqual([]);
  });

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
  // The 11 real sandbox `pri_…` ids Paddle issued for the standalone à-la-carte module SKUs —
  // mirrors the edition/bundle REAL rows' pinning. The four edition-core rows' price ids
  // (pri_01kwj6m31f…, pri_01kwj6m55y…, pri_01kwj6m5mz…, pri_01kwj6m6cb…) were retired with their
  // rows (ADR-0238) and now fail `resolvePurchase` closed — asserted below.
  const REAL_MODULE_PRICE_IDS: Readonly<Record<string, string>> = {
    "field-crypto": "pri_01kwj6m3cwez98t45jzwsqb250",
    "audit-worm": "pri_01kwj6m3mjq4rpv7918rhfhrhw",
    "retention-runner": "pri_01kwj6m3x1cw1k54tcdhsc6pgj",
    "ai-meter": "pri_01kwj6m45zeqyxgad3f32x1b30",
    "ai-evals": "pri_01kwj6m4d3npk8sszerx7fek7w",
    guardrails: "pri_01kwj6m4n105qe80fapw9sk5xc",
    "prompt-registry": "pri_01kwj6m4whyw1stbej2qk8q0bg",
    alerting: "pri_01kwj6m5da9ay3z85b6qwtjcpe",
    "local-store": "pri_01kwj6m5w3s4fmvseap7zmp5yf",
    "agent-kernel": "pri_01kwj6m63qpt52489tq5a3v6q3",
    "agent-runner": "pri_01kwj71a53hycbspsfv8pck5vc",
  };

  const RETIRED_CORE_ROW_PRICE_IDS: readonly string[] = [
    "pri_01kwj6m31fxw5vn532h5ft6780", // compliance_module
    "pri_01kwj6m55yagz7188qer0pa0cd", // ai-kit_module
    "pri_01kwj6m5mzyn76b8jkknmjndb4", // local-ai_module
    "pri_01kwj6m6cbtsh6n5b1bxtb2j0k", // agent-dev_module
  ];

  for (const priceId of RETIRED_CORE_ROW_PRICE_IDS) {
    test(`retired edition-core price id ${priceId} fails resolvePurchase closed (ADR-0238)`, () => {
      expect(() => resolvePurchase(priceId)).toThrow();
    });
  }

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

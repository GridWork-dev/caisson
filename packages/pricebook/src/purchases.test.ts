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

  test("the OSCAL spine sandbox row grants only the standalone module", () => {
    const entry = resolvePurchase("pri_01kye9597z46149qg5xfrqxybk");
    expect<number>(entry.credits).toBe(0);
    expect(entry.entitlements).toEqual(["oscal-spine"]);
    expect(entry.purchaseTag).toBe("oscal-spine_module");
  });
});

describe("per-module à-la-carte PLACEHOLDER rows", () => {
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

describe("W7 catalog big-bang REAL rows (2026-07-06)", () => {
  // The 17 sandbox price ids from the catalog rebuild: 11 carve/new module SKUs (bare slugs) +
  // the 6 bundles keyed to CANONICAL bundle ids — a new bundle grant stores the id the renewal
  // and expansion paths converge on, no alias hop needed.
  const W7_MODULE_PRICE_IDS: Readonly<Record<string, string>> = {
    "compliance-core": "pri_01kwwqa0k69m965tx8hgsv904h",
    "frameworks-pack": "pri_01kwwqa0rkz3etv2yfd6c7jjad",
    "signing-primitive": "pri_01kwwqa0y1hn63taahdh7y03vf",
    credits: "pri_01kwwqa1413c33yfsrvjb4r34a",
    "local-sync": "pri_01kwwqa1b33ycmh114440xc6re",
    "local-inference": "pri_01kwwqa1gvkpj7g0jfna7h2qcr",
    "local-privacy": "pri_01kwwqa1p152hskczw7daszzgn",
    "tool-exec": "pri_01kwwqa1v2gm7cr5g1rpzyk522",
    "org-controls": "pri_01kwwqa20m42dmedx9mprk085k",
    "billing-orchestration": "pri_01kwwqa266p6smw4yaanxg1n5j",
    "ui-pro": "pri_01kwwqa2c799fpe1af76p75r7r",
  };
  const W7_BUNDLE_PRICE_IDS: Readonly<Record<string, string>> = {
    compliance: "pri_01kwwqa2hne35c1df5xe8p91z3",
    "ai-production": "pri_01kwwqa2rcxtn8pt3dr3jdnnf0",
    "local-first": "pri_01kwwqa2xp3jp1qww2j5ya0meh",
    "agentic-dev": "pri_01kwwqa332mweg8veaarkygbae",
    provenance: "pri_01kwwqa3872cs4c53w8qhhz31k",
    everything: "pri_01kwwqa3dfp8k0v5k3bbg3pd5f",
  };

  for (const [slug, priceId] of Object.entries(W7_MODULE_PRICE_IDS)) {
    test(`${priceId} resolves to credits:0, entitlements:[${slug}]`, () => {
      const entry = resolvePurchase(priceId);
      expect<number>(entry.credits).toBe(0);
      expect(entry.entitlements).toEqual([slug]);
      expect(entry.purchaseTag).toBe(`${slug}_module`);
    });
  }

  for (const [bundleId, priceId] of Object.entries(W7_BUNDLE_PRICE_IDS)) {
    test(`${priceId} resolves to the canonical bundle id ${bundleId}`, () => {
      const entry = resolvePurchase(priceId);
      expect<number>(entry.credits).toBe(0);
      expect(entry.entitlements).toEqual([bundleId]);
      expect(entry.purchaseTag).toBe(`${bundleId}_bundle`);
    });
  }
});

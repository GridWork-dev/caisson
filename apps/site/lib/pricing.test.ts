import { describe, expect, test } from "bun:test";

import {
  buildStackSummary,
  bundleSavings,
  EDITION_IDS,
  EDITION_PRICES,
  editionsSubtotal,
  formatPrice,
  formatUsd,
  isEditionId,
  MODULE_PRICES,
  modulesByEdition,
  PLAN_PRICES,
  priceById,
} from "./pricing";

describe("EDITION_PRICES (Q4 below-sum lock)", () => {
  test("editions carry the Q4 below-sum lock values", () => {
    expect(priceById("compliance")?.amount).toBe(749);
    expect(priceById("ai-kit")?.amount).toBe(599);
    expect(priceById("local-first")?.amount).toBe(349);
    expect(priceById("agentic-dev")?.amount).toBe(249);
  });

  test("every edition carries a positive integer amount and no roadmap gating", () => {
    for (const p of EDITION_PRICES) {
      expect(Number.isInteger(p.amount)).toBe(true);
      expect(p.amount).toBeGreaterThan(0);
      expect(p.note.toLowerCase()).not.toContain("roadmap");
    }
  });

  test("all four editions are present", () => {
    expect(EDITION_PRICES.map((p) => p.id).sort()).toEqual(
      [...EDITION_IDS].sort(),
    );
  });

  // Honesty floor (ADR-0130): the site was never live at an earlier number, so no anchor may carry
  // a fabricated struck-through "was" compare price. Guarded at runtime because the field was
  // removed from the type — a re-introduction would be a fresh dark pattern.
  test("no edition or plan anchor carries a fabricated 'was' compare price", () => {
    for (const p of [...EDITION_PRICES, ...PLAN_PRICES]) {
      expect("wasAmount" in p).toBe(false);
    }
  });
});

describe("isEditionId", () => {
  test("accepts every real edition id", () => {
    for (const id of EDITION_IDS) expect(isEditionId(id)).toBe(true);
  });

  test("rejects an unknown id", () => {
    expect(isEditionId("bundle")).toBe(false);
    expect(isEditionId("")).toBe(false);
  });
});

describe("the Everything bundle", () => {
  test("carries the Q4 below-sum bundle price", () => {
    const bundle = priceById("bundle");
    expect(bundle?.amount).toBe(1499);
  });

  test("editionsSubtotal sums the four locked edition prices", () => {
    expect(editionsSubtotal()).toBe(749 + 599 + 249 + 349);
  });

  test("the bundle price is below the sum of the four editions (a real saving)", () => {
    expect(priceById("bundle")?.amount).toBeLessThan(editionsSubtotal());
  });

  test("bundleSavings is the positive gap between the edition subtotal and the bundle price", () => {
    expect(bundleSavings()).toBe(editionsSubtotal() - 1499);
    // The one truthful comparison the site keeps: Save $447 vs à-la-carte (1946 - 1499).
    expect(bundleSavings()).toBe(447);
    expect(bundleSavings()).toBeGreaterThan(0);
  });
});

describe("MODULE_PRICES", () => {
  test("lists exactly 14 modules", () => {
    expect(MODULE_PRICES.length).toBe(14);
  });

  test("module ids are unique", () => {
    const ids = MODULE_PRICES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every module is grouped under a real edition id", () => {
    for (const m of MODULE_PRICES) {
      expect(isEditionId(m.edition)).toBe(true);
    }
  });

  test("every module amount is a positive integer within the locked $49-$299 band", () => {
    for (const m of MODULE_PRICES) {
      expect(Number.isInteger(m.amount)).toBe(true);
      expect(m.amount).toBeGreaterThanOrEqual(49);
      expect(m.amount).toBeLessThanOrEqual(299);
    }
  });

  test("modulesByEdition partitions the catalog with no overlap and no loss", () => {
    const total = EDITION_IDS.reduce(
      (sum, e) => sum + modulesByEdition(e).length,
      0,
    );
    expect(total).toBe(MODULE_PRICES.length);
  });

  test("the per-module PLAN_PRICES anchor tracks the cheapest real module (no drift)", () => {
    const min = Math.min(...MODULE_PRICES.map((m) => m.amount));
    expect(priceById("module")?.amount).toBe(min);
    expect(priceById("module")?.from).toBe(true);
  });
});

describe("formatPrice / formatUsd", () => {
  test("formats a once price with the 'from' prefix", () => {
    expect(formatPrice({ amount: 2499, unit: "once", from: true })).toBe(
      "from $2,499",
    );
  });

  test("formats a yearly subscription with the /yr suffix, no prefix", () => {
    expect(formatPrice({ amount: 1499, unit: "year", from: false })).toBe(
      "$1,499/yr",
    );
  });

  test("formats a null amount as Contact us", () => {
    expect(formatPrice({ amount: null, unit: null, from: false })).toBe(
      "Contact us",
    );
  });

  test("formatUsd renders a bare integer with thousands separators", () => {
    expect(formatUsd(299)).toBe("$299");
    expect(formatUsd(2999)).toBe("$2,999");
  });
});

describe("PLAN_PRICES", () => {
  test("carries no null-amount rows except Enterprise", () => {
    const nullRows = PLAN_PRICES.filter((p) => p.amount === null);
    expect(nullRows.map((p) => p.id)).toEqual(["enterprise"]);
  });
});

describe("buildStackSummary (compose-a-stack math, ADR-0191)", () => {
  const idsOf = (edition: Parameters<typeof modulesByEdition>[0]) =>
    modulesByEdition(edition).map((m) => m.id);

  test("all of one edition's modules nudge to that edition when it costs less", () => {
    const s = buildStackSummary(idsOf("compliance"));
    // 299 + 199 + 149 + 199 = 846 a la carte; the Compliance edition is 749.
    expect(s.total).toBe(846);
    expect(s.moduleCount).toBe(4);
    expect(s.upgrade?.target).toBe("compliance");
    expect(s.upgrade?.price).toBe(749);
    expect(s.upgrade?.saves).toBe(97);
  });

  test("a cross-edition selection above the bundle price nudges to the bundle", () => {
    const s = buildStackSummary([...idsOf("compliance"), ...idsOf("ai-kit")]);
    // 846 + 944 = 1790 a la carte; the Everything bundle is 1499.
    expect(s.total).toBe(1790);
    expect(s.upgrade?.target).toBe("bundle");
    expect(s.upgrade?.saves).toBe(291);
  });

  test("no upgrade offer when a la carte is already the cheapest path", () => {
    // Three of Compliance's four modules (199 + 149 + 199 = 547) cost less than the 749 edition,
    // so nudging to the edition would cost MORE — no offer.
    const s = buildStackSummary([
      "field-crypto",
      "audit-worm",
      "retention-runner",
    ]);
    expect(s.total).toBe(547);
    expect(s.upgrade).toBeUndefined();
  });

  test("empty and unknown ids are ignored", () => {
    expect(buildStackSummary([]).total).toBe(0);
    expect(buildStackSummary([]).upgrade).toBeUndefined();
    expect(buildStackSummary(["not-a-real-module"]).moduleCount).toBe(0);
  });

  test("the running total is always an integer (money is never a float, ADR-0007)", () => {
    expect(Number.isInteger(buildStackSummary(idsOf("ai-kit")).total)).toBe(
      true,
    );
  });
});

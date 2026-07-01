import { describe, expect, test } from "bun:test";

import {
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

describe("EDITION_PRICES (operator's repriced sheet)", () => {
  test("Local-first AI is repriced to $399 (was $499)", () => {
    const p = priceById("local-first");
    expect(p?.amount).toBe(399);
    expect(p?.wasAmount).toBe(499);
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
  test("is repriced to $2,999 (was $3,499)", () => {
    const bundle = priceById("bundle");
    expect(bundle?.amount).toBe(2999);
    expect(bundle?.wasAmount).toBe(3499);
  });

  test("editionsSubtotal sums the four locked edition prices", () => {
    expect(editionsSubtotal()).toBe(2499 + 599 + 499 + 399);
  });

  test("bundleSavings is the positive gap between the edition subtotal and the bundle price", () => {
    expect(bundleSavings()).toBe(editionsSubtotal() - 2999);
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

import { describe, expect, test } from "bun:test";

import { asCredits } from "@caisson/kernel";
import {
  BUNDLE_CATALOG,
  bundleCatalogItem,
  MODULE_CATALOG,
  moduleCatalogItem,
  toCartItem,
} from "./catalog";
import { PURCHASE_BOOK } from "@caisson/pricebook";
import { cartItemSchema } from "./cart";
import { BUNDLE_IDS, MODULE_PRICES } from "./pricing";

describe("catalog id namespacing (no bundle/module collision)", () => {
  test("every catalog id across bundles and modules is unique", () => {
    const ids = [
      ...BUNDLE_CATALOG.map((c) => c.id),
      ...MODULE_CATALOG.map((c) => c.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("no module id collides with a bundle or legacy edition id (ADR-0238/0257 data-lint)", () => {
    // A bare module id that names a bundle (or a legacy edition/bundle-sentinel alias the pricebook
    // still grants) would make `expandEntitlements` resolve the module purchase bundle-first and
    // grant the WHOLE bundle — the ADR-0238 dropped-row bug. This lint keeps the collision from
    // ever coming back.
    const reserved = new Set<string>([
      ...BUNDLE_IDS,
      "ai-kit",
      "local-ai",
      "agent-dev",
      "bundle",
    ]);
    for (const m of MODULE_PRICES) {
      expect(reserved.has(m.id)).toBe(false);
    }
    // Kind-scoped module lookups of bundle/edition slugs miss.
    for (const slug of ["compliance", "ai-kit", "local-ai", "agent-dev"]) {
      expect(moduleCatalogItem(slug)).toBeUndefined();
    }
  });

  test("bundle ids are namespaced `bundle:<slug>`", () => {
    for (const c of BUNDLE_CATALOG) {
      expect(c.id.startsWith("bundle:")).toBe(true);
    }
  });

  test("module ids are namespaced `module:<slug>`", () => {
    for (const c of MODULE_CATALOG) {
      expect(c.id.startsWith("module:")).toBe(true);
    }
  });
});

describe("catalog coverage", () => {
  test("every bundle has a catalog item carrying a real Paddle price id", () => {
    for (const id of BUNDLE_IDS) {
      const item = bundleCatalogItem(id);
      expect(item).toBeDefined();
      expect(item?.priceId.startsWith("pri_")).toBe(true);
    }
  });

  test("every sellable module has a cart catalog item (W7 wired the full catalog)", () => {
    // Post-W7 every SKU_RETAIL module is Paddle-wired — the transitional route-to-bundle CTA state
    // is over. MODULE_CATALOG is a straight map of MODULE_PRICES.
    expect(MODULE_CATALOG.length).toBe(MODULE_PRICES.length);
    for (const c of MODULE_CATALOG) {
      expect(moduleCatalogItem(c.id.replace(/^module:/, ""))).toBeDefined();
      expect(c.priceId.startsWith("pri_")).toBe(true);
    }
  });

  test("every module price id resolves in the pricebook PURCHASE_BOOK to its own entitlement (cart→webhook grant path)", () => {
    // The cart passes catalog.priceId to Paddle.Checkout; the webhook resolves that SAME id in the
    // pricebook to grant the entitlement. A key-convention mismatch (the bug this guards) fails
    // resolvePurchase closed → the module purchase grants nothing. The invariant that matters is not
    // just "the id resolves" but "it resolves to THIS module's slug, license-only" — a purchase must
    // grant exactly the entitlement the buyer paid for.
    for (const c of MODULE_CATALOG) {
      expect(Object.hasOwn(PURCHASE_BOOK, c.priceId)).toBe(true);
      const slug = c.id.replace(/^module:/, "");
      const entry = PURCHASE_BOOK[c.priceId];
      expect(entry?.entitlements).toEqual([slug]);
      expect(entry?.credits).toBe(asCredits(0));
    }
  });

  test("every bundle price id resolves in the pricebook PURCHASE_BOOK to its canonical bundle entitlement", () => {
    // Same cart→webhook invariant for the six bundles: each W7 bundle price id must grant exactly
    // the CANONICAL bundle id (the vocabulary expansion + renewal converge on).
    for (const c of BUNDLE_CATALOG) {
      expect(Object.hasOwn(PURCHASE_BOOK, c.priceId)).toBe(true);
      const slug = c.id.replace(/^bundle:/, "");
      const entry = PURCHASE_BOOK[c.priceId];
      expect(entry?.entitlements).toEqual([slug]);
      expect(entry?.credits).toBe(asCredits(0));
    }
  });
});

describe("toCartItem", () => {
  test("projects a catalog item to a schema-valid cart item (drops blurb)", () => {
    const source = bundleCatalogItem("compliance");
    expect(source).toBeDefined();
    if (!source) return;
    const cartItem = toCartItem(source);
    expect(cartItemSchema.safeParse(cartItem).success).toBe(true);
    expect("blurb" in cartItem).toBe(false);
  });
});

import { describe, expect, test } from "bun:test";

import { asCredits } from "@caisson/kernel";
import {
  BUNDLE_CATALOG_ITEM,
  EDITION_CATALOG,
  editionCatalogItem,
  MODULE_CATALOG,
  moduleCatalogItem,
  toCartItem,
} from "./catalog";
import { PURCHASE_BOOK } from "@caisson/pricebook";
import { cartItemSchema } from "./cart";
import { EDITION_IDS, MODULE_PRICES } from "./pricing";

describe("catalog id namespacing (no edition/module collision)", () => {
  test("every catalog id across editions, bundle, and modules is unique", () => {
    const ids = [
      ...EDITION_CATALOG.map((c) => c.id),
      ...(BUNDLE_CATALOG_ITEM ? [BUNDLE_CATALOG_ITEM.id] : []),
      ...MODULE_CATALOG.map((c) => c.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("the colliding bare slugs resolve to DIFFERENT items by kind", () => {
    // `compliance` and `ai-kit` exist as BOTH an edition and a module — the kind-scoped lookups
    // must never cross-resolve (the bug the namespace prevents).
    for (const slug of ["compliance", "ai-kit"]) {
      const edition = editionCatalogItem(slug);
      const mod = moduleCatalogItem(slug);
      expect(edition?.kind).toBe("edition");
      expect(mod?.kind).toBe("module");
      expect(edition?.id).not.toBe(mod?.id);
      expect(edition?.amount).not.toBe(mod?.amount);
      expect(edition?.priceId).not.toBe(mod?.priceId);
    }
  });

  test("edition ids are namespaced `edition:<slug>`", () => {
    for (const c of EDITION_CATALOG) {
      expect(c.id.startsWith("edition:")).toBe(true);
    }
  });

  test("module ids are namespaced `module:<slug>`", () => {
    for (const c of MODULE_CATALOG) {
      expect(c.id.startsWith("module:")).toBe(true);
    }
  });
});

describe("catalog coverage", () => {
  test("every edition has a catalog item carrying a real Paddle price id", () => {
    for (const id of EDITION_IDS) {
      const item = editionCatalogItem(id);
      expect(item).toBeDefined();
      expect(item?.priceId.startsWith("pri_")).toBe(true);
    }
  });

  test("every one of the 15 modules has a catalog item", () => {
    for (const m of MODULE_PRICES) {
      expect(moduleCatalogItem(m.id)).toBeDefined();
    }
    expect(MODULE_CATALOG.length).toBe(15);
  });

  test("every module has a catalog item carrying a real Paddle price id", () => {
    for (const c of MODULE_CATALOG) {
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

  test("the bundle carries a real Paddle price id", () => {
    expect(BUNDLE_CATALOG_ITEM?.priceId.startsWith("pri_")).toBe(true);
  });
});

describe("toCartItem", () => {
  test("projects a catalog item to a schema-valid cart item (drops blurb)", () => {
    const source = editionCatalogItem("compliance");
    expect(source).toBeDefined();
    if (!source) return;
    const cartItem = toCartItem(source);
    expect(cartItemSchema.safeParse(cartItem).success).toBe(true);
    expect("blurb" in cartItem).toBe(false);
  });
});

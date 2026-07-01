import { describe, expect, test } from "bun:test";

import {
  BUNDLE_CATALOG_ITEM,
  EDITION_CATALOG,
  editionCatalogItem,
  MODULE_CATALOG,
  moduleCatalogItem,
  toCartItem,
} from "./catalog";
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

  test("every one of the 14 modules has a catalog item", () => {
    for (const m of MODULE_PRICES) {
      expect(moduleCatalogItem(m.id)).toBeDefined();
    }
    expect(MODULE_CATALOG.length).toBe(14);
  });

  test("module price ids are placeholders pending pricebook rows", () => {
    for (const c of MODULE_CATALOG) {
      expect(c.priceId).toContain("PLACEHOLDER");
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

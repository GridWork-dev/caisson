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

  test("no module id collides with an edition id (ADR-0238 data-lint)", () => {
    // The four edition-core module rows (`compliance`/`ai-kit`/`local-ai`/`agent-dev`) were
    // DROPPED (ADR-0238): a bare module id that names an edition — either this site's marketing
    // edition slugs OR the registry edition ids the pricebook grants (`local-ai`/`agent-dev`,
    // see catalog.ts's ENTITLEMENT-ID note) — would make `expandEntitlements` resolve the module
    // purchase edition-first and grant the WHOLE parent edition. This lint keeps the collision
    // from ever coming back.
    const editionIds = new Set<string>([
      ...EDITION_IDS,
      "local-ai", // registry edition id (site slug `local-first`)
      "agent-dev", // registry edition id (site slug `agentic-dev`)
    ]);
    for (const m of MODULE_PRICES) {
      expect(editionIds.has(m.id)).toBe(false);
    }
    // The dropped rows are really gone — kind-scoped module lookups of edition slugs miss.
    for (const slug of ["compliance", "ai-kit", "local-ai", "agent-dev"]) {
      expect(moduleCatalogItem(slug)).toBeUndefined();
      expect(editionCatalogItem(slug)?.kind ?? "edition").toBe("edition");
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

  test("every one of the 11 à-la-carte modules has a catalog item", () => {
    for (const m of MODULE_PRICES) {
      expect(moduleCatalogItem(m.id)).toBeDefined();
    }
    expect(MODULE_CATALOG.length).toBe(11);
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

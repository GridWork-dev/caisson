// Bridges the marketing PRICE DISPLAY (`lib/pricing.ts`) to a cart/checkout-ready catalog: every
// sellable one-time item (the 4 editions, the bundle, and the 11 à-la-carte modules) carries the
// Paddle price id the cart's multi-item checkout passes to `Paddle.Checkout.open()`.
//
// CART IDS ARE KIND-NAMESPACED (`edition:<slug>` / `module:<slug>` / `bundle`). No module id
// collides with an edition id anymore (the four edition-core rows were dropped, ADR-0238 — the
// catalog.test.ts data-lint keeps it that way), but the namespace stays: it keeps the cart's
// id-dedup and the grid lookups kind-scoped by construction (`editionCatalogItem` /
// `moduleCatalogItem` / `bundleCatalogItem`), never a bare-slug search, so a future collision is
// contained before it reaches a buyer.
//
// Editions + the bundle map to the REAL Paddle sandbox price ids `@caisson/pricebook`'s
// PURCHASE_BOOK already carries (ADR-0106/0116) — note the pricebook's entitlement ids for
// Local-first AI and Agentic-Dev are `local-ai`/`agent-dev` (the registry edition ids), distinct
// from this site's marketing slugs/labels (see `purchases.ts`'s ENTITLEMENT-ID NOTE). The 11
// modules ALSO carry REAL Paddle sandbox price ids (module-SKU wiring, 2026-07-02) —
// `MODULE_PRICE_IDS` below, matched one-for-one against the module rows `@caisson/pricebook`'s
// PURCHASE_BOOK added in the same wave. `resolvePurchase` throws fail-closed on an unresolved id
// (ADR-0089 §6 / ADR-0113), so a mismatched id reaching production grants nothing rather than
// silently succeeding. This file is display + cart wiring only, not a source of commerce truth.
import type { CartItem } from "./cart";
import {
  type EditionId,
  EDITION_PRICES,
  isEditionId,
  MODULE_PRICES,
  type PriceAnchor,
  priceById,
} from "./pricing";

export type CatalogKind = "module" | "edition" | "bundle";

export interface CatalogItem {
  /** Stable, KIND-NAMESPACED cart key (`edition:<slug>` / `module:<slug>` / `bundle`) — also the
   *  Plausible event prop and the React list key. */
  id: string;
  kind: CatalogKind;
  label: string;
  /** Integer display USD. */
  amount: number;
  /** The real Paddle sandbox price id the pricebook's PURCHASE_BOOK resolves this item against
   *  (see the file header). */
  priceId: string;
  blurb: string;
}

/** Marketing edition slug -> the pricebook's REAL Paddle price id (`purchases.ts`, ADR-0106/0116
 *  sandbox rows). A `Record` over the closed `EditionId` union, not an open index signature — every
 *  edition MUST resolve, so a future 5th edition added to `pricing.ts` without a row here is a
 *  compile error, not a silent `undefined` at checkout time. */
const EDITION_PRICE_IDS: Record<EditionId, string> = {
  compliance: "pri_01kwd76be2eq96kff5nqw236c0",
  "ai-kit": "pri_01kwd76c1pgs2csxcj2n0y7vv0",
  "local-first": "pri_01kwd76cahy825m14334aqf209", // pricebook entitlement id "local-ai"
  "agentic-dev": "pri_01kwd76ck3w8myy4p4f1gj0dcy", // pricebook entitlement id "agent-dev"
};

const BUNDLE_PRICE_ID = "pri_01kwd76bp60acq51mftvpgr42k";

/** À-la-carte module slug -> the pricebook's REAL Paddle price id (`purchases.ts`'s per-module REAL
 *  section, module-SKU wiring 2026-07-02). MUST match the same slug's row there EXACTLY — the cart
 *  passes this `priceId` to Paddle, and the webhook resolves that same id in PURCHASE_BOOK to grant
 *  the entitlement (ADR-0071/0113); a mismatch fails resolvePurchase closed and a module purchase
 *  grants NOTHING. Keyed by every id `pricing.ts`'s MODULE_PRICES carries; `moduleRealPriceId` below
 *  throws if a future module is added there without a matching row here — the runtime mirror of the
 *  `EDITION_PRICE_IDS` `Record<EditionId, string>` compile-time guard above (module ids aren't a
 *  closed union, so the check runs at catalog build time instead of at `tsc`). (catalog.test.ts pins
 *  the cross-package invariant against PURCHASE_BOOK.) */
const MODULE_PRICE_IDS: Record<string, string> = {
  // The four dropped edition-core rows' sandbox price ids (pri_01kwj6m31f…, pri_01kwj6m55y…,
  // pri_01kwj6m5mz…, pri_01kwj6m6cb…) are retired with their rows (ADR-0238) — the products sit
  // orphaned in the Paddle SANDBOX, which never ports to production (ADR-0227).
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

function editionCartId(slug: string): string {
  return `edition:${slug}`;
}

function moduleCartId(slug: string): string {
  return `module:${slug}`;
}

function moduleRealPriceId(moduleId: string): string {
  const priceId = MODULE_PRICE_IDS[moduleId];
  if (!priceId) {
    throw new Error(
      `catalog.ts: no Paddle price id wired in MODULE_PRICE_IDS for module "${moduleId}"`,
    );
  }
  return priceId;
}

function hasAmount(p: PriceAnchor): p is PriceAnchor & { amount: number } {
  return p.amount !== null;
}

/** The four editions as cart-ready catalog items, each carrying its real Paddle price id. */
export const EDITION_CATALOG: readonly CatalogItem[] = EDITION_PRICES.filter(
  hasAmount,
).map((p) => {
  if (!isEditionId(p.id)) {
    throw new Error(`catalog.ts: "${p.id}" is not a known edition id`);
  }
  return {
    id: editionCartId(p.id),
    kind: "edition",
    label: p.label,
    amount: p.amount,
    priceId: EDITION_PRICE_IDS[p.id],
    blurb: p.note,
  };
});

/** The Everything bundle as a cart-ready catalog item, or `undefined` if `pricing.ts` ever drops
 *  the bundle row entirely (defensive — the row is always present today). */
export const BUNDLE_CATALOG_ITEM: CatalogItem | undefined = (() => {
  const bundle = priceById("bundle");
  if (!bundle || bundle.amount === null) return undefined;
  return {
    id: "bundle",
    kind: "bundle",
    label: bundle.label,
    amount: bundle.amount,
    priceId: BUNDLE_PRICE_ID,
    blurb: bundle.note,
  };
})();

/** Every à-la-carte module as a cart-ready catalog item, each carrying its real Paddle price id
 *  (see the file header). */
export const MODULE_CATALOG: readonly CatalogItem[] = MODULE_PRICES.map(
  (m) => ({
    id: moduleCartId(m.id),
    kind: "module",
    label: m.label,
    amount: m.amount,
    priceId: moduleRealPriceId(m.id),
    blurb: m.blurb,
  }),
);

/** Every Paddle price id the live catalog can sell — the hydration allowlist for
 *  `lib/cart.ts` `pruneCart` (a persisted cart line carrying a retired id, e.g. the four
 *  ADR-0238 edition-core rows, is dropped before it can reach checkout). */
export const LIVE_PRICE_IDS: ReadonlySet<string> = new Set(
  [
    ...EDITION_CATALOG,
    ...MODULE_CATALOG,
    ...(BUNDLE_CATALOG_ITEM ? [BUNDLE_CATALOG_ITEM] : []),
  ].map((c) => c.priceId),
);

/** The cart-ready catalog item for an edition slug (`compliance`, `ai-kit`, …). */
export function editionCatalogItem(slug: string): CatalogItem | undefined {
  return EDITION_CATALOG.find((c) => c.id === editionCartId(slug));
}

/** The cart-ready catalog item for a module slug (`field-crypto`, `ai-meter`, …). */
export function moduleCatalogItem(slug: string): CatalogItem | undefined {
  return MODULE_CATALOG.find((c) => c.id === moduleCartId(slug));
}

/** Project a catalog item down to the `CartItem` shape the cart persists (drops `blurb`). */
export function toCartItem(item: CatalogItem): CartItem {
  return {
    id: item.id,
    priceId: item.priceId,
    label: item.label,
    amount: item.amount,
    kind: item.kind,
  };
}

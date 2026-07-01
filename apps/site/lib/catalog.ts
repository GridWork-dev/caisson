// Bridges the marketing PRICE DISPLAY (`lib/pricing.ts`) to a cart/checkout-ready catalog: every
// sellable one-time item (the 4 editions, the bundle, and the 14 à-la-carte modules) carries the
// Paddle price id the cart's multi-item checkout passes to `Paddle.Checkout.open()`.
//
// CART IDS ARE KIND-NAMESPACED (`edition:<slug>` / `module:<slug>` / `bundle`). Two catalog
// entries share a bare slug — the Compliance EDITION and the "Compliance core" MODULE are both
// `compliance`, likewise `ai-kit` — so an un-namespaced id would (a) let the module grid resolve
// the wrong (edition) row and (b) let the cart's id-dedup conflate a $299 module with its $2,499
// edition. The namespace keeps the two independently addable and independently priced. Lookups are
// therefore KIND-SCOPED (`editionCatalogItem` / `moduleCatalogItem` / `bundleCatalogItem`), never a
// bare-slug search.
//
// Editions + the bundle map to the REAL Paddle sandbox price ids `@caisson/pricebook`'s
// PURCHASE_BOOK already carries (ADR-0106/0116) — note the pricebook's entitlement ids for
// Local-first AI and Agentic-Dev are `local-ai`/`agent-dev` (the registry edition ids), distinct
// from this site's marketing slugs/labels (see `purchases.ts`'s ENTITLEMENT-ID NOTE). The 14
// modules have no pricebook rows yet — the pricebook only prices whole editions today — so each
// carries a clearly-marked `..._PLACEHOLDER` id in the SAME naming convention `@caisson/pricebook`
// itself uses for its own placeholder rows. `resolvePurchase` throws fail-closed on an unresolved
// id (ADR-0089 §6 / ADR-0113), so a placeholder id reaching production grants nothing rather than
// silently succeeding. The pricebook track owns adding the real per-module rows when those products
// are created in Paddle; this file is display + cart wiring only, not a source of commerce truth.
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
  /** A real Paddle price id where the pricebook already carries one; a `..._PLACEHOLDER` id
   *  otherwise (see the file header). */
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

function editionCartId(slug: string): string {
  return `edition:${slug}`;
}

function moduleCartId(slug: string): string {
  return `module:${slug}`;
}

function modulePlaceholderId(moduleId: string): string {
  // MUST match @caisson/pricebook's PURCHASE_BOOK key convention EXACTLY
  // (`price_<slug>_module_PLACEHOLDER`) — the cart passes this priceId to Paddle, and the webhook
  // resolves that same id in PURCHASE_BOOK to grant the entitlement (ADR-0071/0113). A convention
  // mismatch fails resolvePurchase closed → a module purchase would grant NOTHING. At go-live the
  // real Paddle `pri_…` ids replace BOTH this and the pricebook key (a matched, manual 14-id fill).
  // (catalog.test.ts pins the cross-package invariant against PURCHASE_BOOK.)
  return `price_${moduleId.replace(/-/g, "_")}_module_PLACEHOLDER`;
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

/** Every à-la-carte module as a cart-ready catalog item, each carrying a placeholder Paddle price
 *  id (see the file header — no real per-module pricebook rows exist pre-go-live). */
export const MODULE_CATALOG: readonly CatalogItem[] = MODULE_PRICES.map(
  (m) => ({
    id: moduleCartId(m.id),
    kind: "module",
    label: m.label,
    amount: m.amount,
    priceId: modulePlaceholderId(m.id),
    blurb: m.blurb,
  }),
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

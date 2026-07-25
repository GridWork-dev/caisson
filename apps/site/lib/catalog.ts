// Bridges the marketing PRICE DISPLAY (`lib/pricing.ts`) to a cart/checkout-ready catalog: every
// sellable one-time item (the 6 bundles and the 22 à-la-carte modules) carries the Paddle price id
// the cart's multi-item checkout passes to `Paddle.Checkout.open()`.
//
// CART IDS ARE KIND-NAMESPACED (`bundle:<slug>` / `module:<slug>`). A bundle id can collide with a
// module-adjacent name, so the namespace keeps the cart's id-dedup and the grid lookups kind-scoped
// by construction (`bundleCatalogItem` / `moduleCatalogItem`), never a bare-slug search.
//
// Bundles + modules map to the REAL Paddle sandbox price ids `@caisson/pricebook`'s PURCHASE_BOOK
// carries (the W7 catalog big-bang section; the original 11 modules from the 2026-07-02 module-SKU
// wiring). `resolvePurchase` throws fail-closed on an unresolved id (ADR-0089 §6 / ADR-0113), so a
// mismatched id reaching production grants nothing rather than silently succeeding. The retired
// edition-era ids (4 editions + the legacy $1,499 bundle) are absent — their Paddle products are
// archived, and `pruneCart` drops any persisted cart line still carrying one. This file is
// display + cart wiring only, not a source of commerce truth.
import type { CartItem } from "./cart";
import { type BundleId, BUNDLE_PRICES, MODULE_PRICES } from "./pricing";

export type CatalogKind = "module" | "bundle";

export interface CatalogItem {
  /** Stable, KIND-NAMESPACED cart key (`bundle:<slug>` / `module:<slug>`) — also the Plausible
   *  event prop and the React list key. */
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

/** Bundle id -> the pricebook's REAL Paddle price id (`purchases.ts`, W7 catalog big-bang rows —
 *  each grants the CANONICAL bundle entitlement id). A `Record` over the closed `BundleId` union,
 *  not an open index signature — every bundle MUST resolve, so a future 7th bundle added to
 *  `pricing.ts` without a row here is a compile error, not a silent `undefined` at checkout time. */
const BUNDLE_PRICE_IDS: Record<BundleId, string> = {
  compliance: "pri_01kwwqa2hne35c1df5xe8p91z3",
  "ai-production": "pri_01kwwqa2rcxtn8pt3dr3jdnnf0",
  "local-first": "pri_01kwwqa2xp3jp1qww2j5ya0meh",
  "agentic-dev": "pri_01kwwqa332mweg8veaarkygbae",
  provenance: "pri_01kwwqa3872cs4c53w8qhhz31k",
  everything: "pri_01kwwqa3dfp8k0v5k3bbg3pd5f",
};

/** À-la-carte module slug -> the pricebook's REAL Paddle price id (`purchases.ts`'s per-module REAL
 *  section, module-SKU wiring 2026-07-02). MUST match the same slug's row there EXACTLY — the cart
 *  passes this `priceId` to Paddle, and the webhook resolves that same id in PURCHASE_BOOK to grant
 *  the entitlement (ADR-0071/0113); a mismatch fails resolvePurchase closed and a module purchase
 *  grants NOTHING. Keyed by every id `pricing.ts`'s MODULE_PRICES carries; `moduleRealPriceId` below
 *  throws if a future module is added there without a matching row here — the runtime mirror of the
 *  `BUNDLE_PRICE_IDS` `Record<BundleId, string>` compile-time guard above (module ids aren't a
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
  // agent-trajectory joined the catalog 2026-07-18 (agent-runtime wave) — created via
  // tools/paddle-catalog-recreate.ts against the sandbox, marker custom_data.caisson_id.
  "agent-trajectory": "pri_01kxvpjjx55q4cf21cwjbjhwv5",
  // The compliance-gap trio joined the catalog 2026-07-20 (SKU-arming wave) — created via
  // tools/paddle-catalog-recreate.ts against the sandbox, marker custom_data.caisson_key.
  "access-review": "pri_01ky0fgqdwpf6yaxzeef03q88e",
  "risk-register": "pri_01ky0fgqk5d855hfjdngjrvj89",
  "trust-page": "pri_01ky0fgqqzmfbm2406q4rys44e",
  // The 11 carve/standalone SKUs from the W7 catalog big-bang (each matched one-for-one against
  // the pricebook's W7 PURCHASE_BOOK rows).
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

function bundleCartId(slug: string): string {
  return `bundle:${slug}`;
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

/** The six bundles as cart-ready catalog items, each carrying its real Paddle price id. */
export const BUNDLE_CATALOG: readonly CatalogItem[] = BUNDLE_PRICES.map((p) => {
  if (p.amount === null) {
    throw new Error(`catalog.ts: bundle "${p.id}" has no committed amount`);
  }
  return {
    id: bundleCartId(p.id),
    kind: "bundle" as const,
    label: p.label,
    amount: p.amount,
    priceId: BUNDLE_PRICE_IDS[p.id],
    blurb: p.note,
  };
});

/** Every à-la-carte module as a cart-ready catalog item. Post-W7 every sellable SKU is
 *  Paddle-wired, so this is a straight map — a module added to `pricing.ts` without a
 *  `MODULE_PRICE_IDS` row fails the build via `moduleRealPriceId`'s fail-closed throw (never a
 *  silently unpurchasable card). */
export const MODULE_CATALOG: readonly CatalogItem[] = MODULE_PRICES.map(
  (m) => ({
    id: moduleCartId(m.id),
    kind: "module" as const,
    label: m.label,
    amount: m.amount,
    priceId: moduleRealPriceId(m.id),
    blurb: m.blurb,
  }),
);

/** Every Paddle price id the live catalog can sell — the hydration allowlist for
 *  `lib/cart.ts` `pruneCart` (a persisted cart line carrying a retired id — the four ADR-0238
 *  edition-core rows, the 4 archived editions, or the legacy $1,499 bundle — is dropped before it
 *  can reach checkout). */
export const LIVE_PRICE_IDS: ReadonlySet<string> = new Set(
  [...BUNDLE_CATALOG, ...MODULE_CATALOG].map((c) => c.priceId),
);

/** The cart-ready catalog item for a bundle slug (`compliance`, `everything`, …). */
export function bundleCatalogItem(slug: string): CatalogItem | undefined {
  return BUNDLE_CATALOG.find((c) => c.id === bundleCartId(slug));
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

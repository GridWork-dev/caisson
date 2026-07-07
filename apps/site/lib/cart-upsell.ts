// Cart-aware bundle upsell — pure integer math over the cart + the pricing catalog (money is never
// a float, ADR-0007). Given the cart, for each persona/Provenance bundle it sums the member modules
// already in the cart and, when that overlap reaches 60% of the bundle price, offers the whole
// bundle. The Everything (whole-catalog) nudge stays in `lib/cart.ts` (`cartUpgrade`) — a different
// rule (any cart worth more than the Everything price) — and the callout shows a persona upsell
// first, falling back to the Everything nudge. No React here; the banner + one-click swap wire this
// in `components/cart-shared.tsx`.

import type { CartItem } from "./cart";
import {
  type BundleId,
  bundleModuleSubtotal,
  bundlePriceById,
  modulesByBundle,
  PERSONA_BUNDLE_IDS,
} from "./pricing";

const MODULE_ID_PREFIX = "module:";

export interface BundleUpsell {
  bundleId: BundleId;
  bundleLabel: string;
  /** The bundle's committed price (integer USD). */
  bundlePrice: number;
  /** The `module:<slug>` cart line ids the one-click swap removes. */
  memberItemIds: readonly string[];
  memberCount: number;
  /** Sum of the covered member modules already in the cart (integer USD). */
  overlapSum: number;
  /** `bundlePrice - overlapSum` (integer USD): > 0 = pay this much more for the whole bundle,
   *  < 0 = save this much, 0 = same price. */
  delta: number;
  /** Fraction of the bundle's à-la-carte member value the cart already holds — the ranking key
   *  ("best coverage"). A ratio, not money. */
  coverage: number;
}

/** The bare module slug of a cart line, or `null` when the line is not an à-la-carte module. */
function moduleSlug(item: CartItem): string | null {
  return item.kind === "module" && item.id.startsWith(MODULE_ID_PREFIX)
    ? item.id.slice(MODULE_ID_PREFIX.length)
    : null;
}

/** overlap ≥ 60% of the bundle price, kept float-free (60% = 3/5) so the gate is exact integer math. */
function meetsThreshold(overlapSum: number, price: number): boolean {
  return overlapSum * 5 >= price * 3;
}

/**
 * The single best persona/Provenance-bundle upsell for the current cart, or `undefined` when none
 * clears the 60% bar. A bundle already in the cart is never suggested. When several bundles qualify,
 * the one the cart most completely covers (highest `coverage`) wins, tie-broken toward the smaller
 * delta (cheapest to complete / biggest saving), then bundle display order.
 */
export function bestBundleUpsell(
  items: readonly CartItem[],
): BundleUpsell | undefined {
  const bundlesInCart = new Set(
    items.filter((i) => i.kind === "bundle").map((i) => i.id),
  );
  const candidates: BundleUpsell[] = [];

  for (const bundleId of PERSONA_BUNDLE_IDS) {
    if (bundlesInCart.has(`bundle:${bundleId}`)) continue; // already-has-bundle → no suggestion
    const anchor = bundlePriceById(bundleId);
    if (!anchor || anchor.amount === null) continue;

    const memberSlugs = new Set(modulesByBundle(bundleId).map((m) => m.id));
    const memberItems = items.filter((i) => {
      const slug = moduleSlug(i);
      return slug !== null && memberSlugs.has(slug);
    });
    if (memberItems.length === 0) continue;

    const overlapSum = memberItems.reduce((sum, i) => sum + i.amount, 0);
    if (!meetsThreshold(overlapSum, anchor.amount)) continue;

    const memberSubtotal = bundleModuleSubtotal(bundleId);
    candidates.push({
      bundleId,
      bundleLabel: anchor.label,
      bundlePrice: anchor.amount,
      memberItemIds: memberItems.map((i) => i.id),
      memberCount: memberItems.length,
      overlapSum,
      delta: anchor.amount - overlapSum,
      coverage: memberSubtotal > 0 ? overlapSum / memberSubtotal : 0,
    });
  }

  if (candidates.length === 0) return undefined;
  candidates.sort((a, b) => {
    if (b.coverage !== a.coverage) return b.coverage - a.coverage;
    return a.delta - b.delta;
  });
  return candidates[0];
}

/**
 * The cart after accepting `upsell`: the covered member lines removed, the bundle line added (deduped
 * if somehow already present). The bundle `CartItem` — carrying its real Paddle price id — is passed
 * in by the caller (resolved from `lib/catalog.ts`, which owns the commerce wiring), keeping this
 * transform pure over cart data.
 */
export function applyBundleUpsell(
  items: readonly CartItem[],
  upsell: BundleUpsell,
  bundleItem: CartItem,
): CartItem[] {
  const remove = new Set(upsell.memberItemIds);
  const kept = items.filter((i) => !remove.has(i.id));
  return kept.some((i) => i.id === bundleItem.id)
    ? kept
    : [...kept, bundleItem];
}

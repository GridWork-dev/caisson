"use client";

import Link from "next/link";

import { Icon, Toast } from "@caisson/ui/components";

import { Button } from "@/components";
import { cartSubtotal, cartUpgrade, type CartItem } from "@/lib/cart";
import { applyBundleUpsell, bestBundleUpsell } from "@/lib/cart-upsell";
import { bundleCatalogItem, toCartItem } from "@/lib/catalog";
import { PADDLE_MOR_DISCLOSURE } from "@/lib/legal";
import { formatUsd } from "@/lib/pricing";

import { useCart } from "./cart-provider";
import styles from "./cart.module.css";

// The pieces the fast drawer (glance) and the /cart page (rich) BOTH render, single-sourced so the
// two surfaces differ in depth, not in duplicated JSX (D-5, ADR-0193). The drawer passes
// density="compact"; /cart passes density="comfortable".

// Cart ids are kind-namespaced (`edition:<slug>` / `module:<slug>` / `bundle:<slug>`, lib/catalog.ts).
// The cart id IS the marketplace card-viewer deep-link (`?view=<kind>:<slug>`, ADR-0285), so a
// module/bundle line opens straight to its viewer on the one surface; a legacy edition line links to
// its product page.
function itemHref(item: CartItem): string {
  if (item.kind === "edition") return `/${item.id.slice("edition:".length)}`;
  if (item.kind === "module" || item.kind === "bundle")
    return `/marketplace?view=${item.id}`;
  return "/marketplace";
}

/** One cart line — a linked label, its price, and a remove button. `comfortable` adds the kind
 *  caption and a heavier label; `compact` is the drawer's tighter row. */
export function CartLineItem({
  item,
  density = "compact",
}: {
  item: CartItem;
  density?: "compact" | "comfortable";
}) {
  const { removeItem } = useCart();
  return (
    <li className={styles.line} data-density={density}>
      <div className={styles.lineMain}>
        <Link href={itemHref(item)} className={styles.lineLabel}>
          {item.label}
        </Link>
        {density === "comfortable" && (
          <span className={styles.lineKind}>{item.kind}</span>
        )}
      </div>
      <span className={`cs-num ${styles.linePrice}`}>
        {formatUsd(item.amount)}
      </span>
      <button
        type="button"
        className={styles.remove}
        aria-label={`Remove ${item.label} from cart`}
        onClick={() => removeItem(item.id)}
      >
        <Icon name="x" />
      </button>
    </li>
  );
}

/** The honest bundle nudge, shown on both surfaces (drawer + /cart). A persona/Provenance-bundle
 *  upsell wins when the cart already holds ≥ 60% of a bundle's price in its member modules
 *  (`bestBundleUpsell`); the one-click swap removes just those member lines and adds the bundle.
 *  Otherwise it falls back to the whole-catalog Everything nudge (`cartUpgrade`), which replaces the
 *  cart with the single bundle line (a strict superset). `replaceCart` — not clear()+addItem — so the
 *  in-place swap doesn't pop the modal drawer on /cart. All math is integer USD (ADR-0007). */
export function CartUpgradeCallout() {
  const { items, replaceCart } = useCart();

  // Persona/Provenance bundle upsell first (member-overlap ≥ 60% of the bundle price).
  const persona = bestBundleUpsell(items);
  if (persona) {
    const bundleItem = bundleCatalogItem(persona.bundleId);
    if (bundleItem) {
      const swap = () =>
        replaceCart(applyBundleUpsell(items, persona, toCartItem(bundleItem)));
      const deltaText =
        persona.delta > 0
          ? `add ${formatUsd(persona.delta)} for everything in it`
          : persona.delta < 0
            ? `save ${formatUsd(-persona.delta)}`
            : "for the same price";
      const countText =
        persona.memberCount === 1
          ? "1 module in your cart is part of"
          : `${persona.memberCount} modules in your cart are part of`;
      return (
        <div className={styles.upgrade}>
          <p className={styles.upgradeText}>
            {countText} the {persona.bundleLabel} bundle — get the whole bundle
            for {formatUsd(persona.bundlePrice)} and {deltaText}.
          </p>
          <Button type="button" variant="primary" onClick={swap}>
            Switch to the {persona.bundleLabel} bundle
          </Button>
        </div>
      );
    }
  }

  // Fallback: the whole-catalog Everything nudge.
  const everything = bundleCatalogItem("everything");
  if (everything === undefined) return null;
  const upgrade = cartUpgrade(items, toCartItem(everything));
  if (upgrade === undefined) return null;

  const switchToBundle = () => replaceCart([upgrade.bundle]);

  return (
    <div className={styles.upgrade}>
      <p className={styles.upgradeText}>
        Your cart totals {formatUsd(cartSubtotal(items))}. The{" "}
        {upgrade.bundle.label} bundle covers the whole catalog for{" "}
        {formatUsd(upgrade.bundle.amount)} — save {formatUsd(upgrade.saves)}.
      </p>
      <Button type="button" variant="primary" onClick={switchToBundle}>
        Switch to the bundle
      </Button>
    </div>
  );
}

/** One-line notice for lines `pruneCart` silently dropped at hydration (G32) — a retired SKU still
 *  sitting in localStorage. Shown on both surfaces (drawer + /cart); dismissible, and clears on the
 *  next hydration regardless. Renders nothing when there is nothing to report. */
export function CartPrunedNotice() {
  const { prunedItems, dismissPrunedNotice } = useCart();
  if (prunedItems.length === 0) return null;
  const names = prunedItems.map((i) => i.label).join(", ");
  return (
    <Toast tone="info" onDismiss={dismissPrunedNotice}>
      {prunedItems.length === 1
        ? `${names} is no longer available and was removed from your cart.`
        : `${names} are no longer available and were removed from your cart.`}
    </Toast>
  );
}

/** The one-time-license reassurance line + the verbatim Paddle MoR disclosure, shared so the
 *  drawer, /cart, and the checkout panel all say them identically. */
export function CartTrustNote() {
  return (
    <>
      <p className={styles.trust}>
        One-time perpetual license per organization, billed once — your whole
        team, no seat count, no forced renewal.
      </p>
      {/* D12 item 2 (PRD-4/T3): the month-13 answer at the checkout itself. Both purchase surfaces
          (drawer + /cart) render this note, so every buy path carries it, not just one page. Terms
          unchanged — the full version lives at /marketplace/plans#after-twelve-months. */}
      <p className={styles.trust}>
        Includes 12 months of updates. After that the code stays yours forever —
        only new updates lapse, renewable per entitlement.{" "}
        <Link href="/marketplace/plans#after-twelve-months">
          What happens after 12 months →
        </Link>
      </p>
      <p className={styles.trust}>{PADDLE_MOR_DISCLOSURE}</p>
    </>
  );
}

"use client";

import Link from "next/link";

import { Icon } from "@caisson/ui/components";

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

// Cart ids are kind-namespaced (`edition:<slug>` / `module:<slug>` / `bundle`, lib/catalog.ts).
// Editions have a product page; modules resolve to the catalog; the bundle to the marketplace hub.
function itemHref(item: CartItem): string {
  if (item.kind === "edition") return `/${item.id.slice("edition:".length)}`;
  if (item.kind === "module") return "/marketplace/modules";
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

/** The one-time-license reassurance line + the verbatim Paddle MoR disclosure, shared so the
 *  drawer, /cart, and the checkout panel all say them identically. */
export function CartTrustNote() {
  return (
    <>
      <p className={styles.trust}>
        One-time perpetual license, billed once — no seat count, no forced
        renewal.
      </p>
      <p className={styles.trust}>{PADDLE_MOR_DISCLOSURE}</p>
    </>
  );
}

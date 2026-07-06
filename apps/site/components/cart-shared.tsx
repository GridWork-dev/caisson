"use client";

import Link from "next/link";

import { Icon } from "@caisson/ui/components";

import { Button } from "@/components";
import { cartSubtotal, cartUpgrade, type CartItem } from "@/lib/cart";
import { BUNDLE_CATALOG_ITEM, toCartItem } from "@/lib/catalog";
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

/** The honest bundle nudge — shown on both surfaces exactly when the Everything bundle would cover
 *  the cart for less than its current subtotal (`cartUpgrade`). "Switch" replaces the cart with the
 *  single bundle line, since the bundle is a strict superset of everything the cart could hold. */
export function CartUpgradeCallout() {
  const { items, replaceCart } = useCart();
  if (BUNDLE_CATALOG_ITEM === undefined) return null;
  const upgrade = cartUpgrade(items, toCartItem(BUNDLE_CATALOG_ITEM));
  if (upgrade === undefined) return null;

  // The bundle is a strict superset, so switching REPLACES the cart with the single bundle line.
  // replaceCart (not clear()+addItem) so this in-place swap doesn't pop the modal drawer on /cart.
  const switchToBundle = () => replaceCart([upgrade.bundle]);

  return (
    <div className={styles.upgrade}>
      <p className={styles.upgradeText}>
        Your cart totals {formatUsd(cartSubtotal(items))}. The{" "}
        {upgrade.bundle.label} covers every edition for{" "}
        {formatUsd(upgrade.bundle.amount)} — save {formatUsd(upgrade.saves)}.
      </p>
      <Button type="button" variant="primary" onClick={switchToBundle}>
        Switch to the bundle
      </Button>
    </div>
  );
}

/** The one-time-license reassurance line, shared so the drawer and /cart say it identically. */
export function CartTrustNote() {
  return (
    <p className={styles.trust}>
      One-time perpetual license, billed once — no seat count, no forced
      renewal.
    </p>
  );
}

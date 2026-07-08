"use client";

import { Button } from "@/components";
import { trackEvent } from "@/lib/analytics";
import type { CartItem } from "@/lib/cart";

import { useCart } from "./cart-provider";
import { useOwnedItems } from "./owned-items-provider";

export interface AddToCartButtonProps {
  item: CartItem;
  variant?: "primary" | "ghost";
  /** Fired after the item lands in the cart — e.g. the module preview dialog closes itself so the
   *  opened cart drawer isn't stacked under it. */
  onAdded?: (() => void) | undefined;
}

/**
 * Adds `item` to the cart and opens the drawer as feedback. Swaps to "In cart" (disabled) once
 * added — a repeat click is a no-op either way (`lib/cart.ts`'s `addCartItem` dedups on id), the
 * disabled state just makes that visible instead of silently doing nothing. Also disables + relabels
 * to "Owned" when the signed-in account already holds this item's entitlement (G16) — an owner can
 * still re-add and re-pay for something they own otherwise, since webhook idempotency only dedups a
 * retried payment id, not a genuine second transaction.
 */
export function AddToCartButton({
  item,
  variant = "ghost",
  onAdded,
}: AddToCartButtonProps) {
  const { items, addItem } = useCart();
  const owned = useOwnedItems();
  const inCart = items.some((i) => i.id === item.id);
  const isOwned = owned.has(item.id);

  return (
    <Button
      type="button"
      variant={variant}
      disabled={inCart || isOwned}
      onClick={() => {
        addItem(item);
        trackEvent("add_to_cart", {
          item: item.id,
          amount: String(item.amount),
        });
        onAdded?.();
      }}
    >
      {isOwned ? "Owned" : inCart ? "In cart" : "Add to cart"}
    </Button>
  );
}

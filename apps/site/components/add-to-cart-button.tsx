"use client";

import { Button } from "@/components";
import type { CartItem } from "@/lib/cart";

import { useCart } from "./cart-provider";

export interface AddToCartButtonProps {
  item: CartItem;
  variant?: "primary" | "ghost";
}

/**
 * Adds `item` to the cart and opens the drawer as feedback. Swaps to "In cart" (disabled) once
 * added — a repeat click is a no-op either way (`lib/cart.ts`'s `addCartItem` dedups on id), the
 * disabled state just makes that visible instead of silently doing nothing.
 */
export function AddToCartButton({
  item,
  variant = "ghost",
}: AddToCartButtonProps) {
  const { items, addItem } = useCart();
  const inCart = items.some((i) => i.id === item.id);

  return (
    <Button
      type="button"
      variant={variant}
      disabled={inCart}
      onClick={() => addItem(item)}
    >
      {inCart ? "In cart" : "Add to cart"}
    </Button>
  );
}

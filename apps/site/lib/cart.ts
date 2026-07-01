// Cart state — pure data + validation, no React (testable in isolation, `bun:test`). React
// wiring lives in `components/cart-provider.tsx`. The cart only ever holds ONE-TIME items
// (editions / the bundle / à-la-carte modules): a subscription is sold through its existing
// single-item flow (`/dashboard/plan`), not mixed into a multi-item cart.
import { z } from "zod";

export const cartItemSchema = z
  .object({
    /** The catalog item id this line represents (`lib/catalog.ts` `CatalogItem.id`). */
    id: z.string().trim().min(1).max(128),
    /** The Paddle price id the checkout passes for this line. */
    priceId: z.string().trim().min(1).max(128),
    label: z.string().trim().min(1).max(200),
    /** Integer display USD (money is never a float, ADR-0007). */
    amount: z.number().int().nonnegative(),
    kind: z.enum(["module", "edition", "bundle"]),
  })
  .strict();

export type CartItem = z.infer<typeof cartItemSchema>;

/** `localStorage` key the cart persists under — bump the version suffix on a breaking shape
 *  change so an old stored cart parses to empty instead of throwing (handled by
 *  `parseStoredCart`'s fail-closed Zod parse either way). */
export const CART_STORAGE_KEY = "cs-cart-v1";

/** Add `item` if its id is not already present (no duplicate lines, no quantity — every SKU this
 *  site sells is a perpetual license, not a stackable quantity). Returns a NEW array; never
 *  mutates `items`. */
export function addCartItem(
  items: readonly CartItem[],
  item: CartItem,
): CartItem[] {
  if (items.some((i) => i.id === item.id)) return [...items];
  return [...items, item];
}

/** Drop the line matching `id`. Returns a NEW array; never mutates `items`. */
export function removeCartItem(
  items: readonly CartItem[],
  id: string,
): CartItem[] {
  return items.filter((i) => i.id !== id);
}

/** Sum of every line's integer amount. */
export function cartSubtotal(items: readonly CartItem[]): number {
  return items.reduce((sum, i) => sum + i.amount, 0);
}

export function isInCart(items: readonly CartItem[], id: string): boolean {
  return items.some((i) => i.id === id);
}

/**
 * Parse a JSON blob read from `localStorage`. Fail-closed: `null`, malformed JSON, or a payload
 * that fails the strict per-item schema (e.g. a tampered/legacy shape) all collapse to an empty
 * cart rather than throwing into a render — a corrupt cart is a bad checkout, not a broken page.
 */
export function parseStoredCart(raw: string | null): CartItem[] {
  if (raw === null || raw.trim() === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const result = z.array(cartItemSchema).safeParse(parsed);
  return result.success ? result.data : [];
}

export function serializeCart(items: readonly CartItem[]): string {
  return JSON.stringify(items);
}

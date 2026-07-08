"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { trackEvent } from "@/lib/analytics";
import {
  addCartItem,
  CART_STORAGE_KEY,
  cartSubtotal,
  type CartItem,
  parseStoredCart,
  pruneCart,
  prunedLines,
  removeCartItem,
  serializeCart,
} from "@/lib/cart";
import { LIVE_PRICE_IDS } from "@/lib/catalog";

export interface CartContextValue {
  items: readonly CartItem[];
  subtotal: number;
  drawerOpen: boolean;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  /** Replace the whole cart in place WITHOUT opening the drawer — for an in-place swap (e.g. the
   *  bundle nudge on /cart), where addItem's drawer-open would pop a modal over the page. */
  replaceCart: (items: readonly CartItem[]) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  /** Lines silently dropped by the hydration-time `pruneCart` (G32) — a retired SKU still in
   *  localStorage. Empty once acknowledged (`dismissPrunedNotice`) or on the next hydration. */
  prunedItems: readonly CartItem[];
  dismissPrunedNotice: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

/**
 * Cart state, persisted to `localStorage` under `CART_STORAGE_KEY`. Hydrates AFTER mount (the
 * `hydrated` gate below) so the server-rendered markup and the first client render agree —
 * reading `localStorage` during the initial render would desync hydration.
 *
 * Scoped per route group: the marketing layout and the authed `/dashboard/cart` page each mount
 * their own `CartProvider`. Both read/write the SAME `CART_STORAGE_KEY` on the SAME origin (this
 * is one unified Next app, ADR-0114), so the cart a visitor builds on the public pricing page is
 * the same cart the authed checkout panel sees once they sign in — no server-side cart state to
 * keep in sync, no cart id to pass around.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [prunedItems, setPrunedItems] = useState<CartItem[]>([]);

  useEffect(() => {
    // Prune against the live catalog: a persisted line with a retired price id (ADR-0238) would
    // charge at Paddle and then fail closed at the webhook — drop it before it can check out.
    // G32: the diff (stored - kept) is surfaced as a one-line notice instead of vanishing silently.
    const stored = parseStoredCart(
      window.localStorage.getItem(CART_STORAGE_KEY),
    );
    const kept = pruneCart(stored, LIVE_PRICE_IDS);
    setPrunedItems(prunedLines(stored, kept));
    setItems(kept);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(items));
  }, [items, hydrated]);

  // One view_cart per drawer open (ADR-0237 F8) — the single chokepoint every opener routes
  // through, so the event can't fork per call site.
  useEffect(() => {
    if (drawerOpen) trackEvent("view_cart", { items: String(items.length) });
    // items.length is a label, not a trigger — re-firing on cart mutation would double-count,
    // so the deps are deliberately [drawerOpen] only.
  }, [drawerOpen]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      subtotal: cartSubtotal(items),
      drawerOpen,
      addItem: (item) => {
        setItems((prev) => addCartItem(prev, item));
        setDrawerOpen(true);
      },
      removeItem: (id) => setItems((prev) => removeCartItem(prev, id)),
      replaceCart: (next) => setItems([...next]),
      clear: () => setItems([]),
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      toggleDrawer: () => setDrawerOpen((v) => !v),
      prunedItems,
      dismissPrunedNotice: () => setPrunedItems([]),
    }),
    [items, drawerOpen, prunedItems],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (ctx === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}

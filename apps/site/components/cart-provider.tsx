"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  /** Increments on every `addItem` — the nav badge keys off it so each add re-mounts and re-pulses
   *  the count (a compositor-only, reduced-motion-safe animation). Not tied to `items.length` so a
   *  remove doesn't pulse. */
  addPulse: number;
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
  const [addPulse, setAddPulse] = useState(0);

  // First-add-per-page rule (ADR-0378 lock 4): the FIRST addItem in a page view auto-opens the
  // drawer (the confirmation + bundle-savings-nudge impression); later adds on the same page view
  // only pulse the badge. The flag resets on navigation, and /cart + /dashboard/cart never
  // auto-open (a drawer over a cart page is redundant).
  const pathname = usePathname();
  const firstAddRef = useRef(false);
  useEffect(() => {
    firstAddRef.current = false;
  }, [pathname]);

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
        setAddPulse((n) => n + 1);
        const noAutoOpen =
          pathname === "/cart" || pathname === "/dashboard/cart";
        if (!firstAddRef.current && !noAutoOpen) {
          firstAddRef.current = true;
          setDrawerOpen(true);
        }
      },
      removeItem: (id) => setItems((prev) => removeCartItem(prev, id)),
      replaceCart: (next) => setItems([...next]),
      clear: () => setItems([]),
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      toggleDrawer: () => setDrawerOpen((v) => !v),
      addPulse,
      prunedItems,
      dismissPrunedNotice: () => setPrunedItems([]),
    }),
    [items, drawerOpen, prunedItems, addPulse, pathname],
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

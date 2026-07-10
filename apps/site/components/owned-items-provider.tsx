"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/**
 * The signed-in account's already-owned catalog cart-item ids (G16), fetched client-side from
 * `GET /api/cart/owned` after mount — mirrors `CartProvider`'s post-mount hydration so a public
 * marketing page stays statically generated (no per-request session read at SSR time). Starts
 * empty (a signed-out visitor's steady state) and fills in once the fetch resolves; a fetch
 * failure — offline, the route erroring — leaves it empty rather than blocking the page, since
 * the worst case is a buyer sees an un-disabled Buy button for something they already own, not a
 * broken cart.
 *
 * The fetch is deliberately UNCONDITIONAL: the better-auth session cookie is HttpOnly
 * (identity/security.md), so no client-side check can distinguish signed-in from signed-out — and
 * the owned-items disable this feeds is the only guard against a signed-in owner re-paying for
 * something they already own (add-to-cart-button.tsx). Skipping the signed-out round trip
 * (ADR-0310 slice b) needs a server-minted non-HttpOnly session-hint cookie first.
 */
const OwnedItemsContext = createContext<ReadonlySet<string>>(new Set());

export function OwnedItemsProvider({ children }: { children: ReactNode }) {
  const [owned, setOwned] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cart/owned", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { owned: [] }))
      .then((data: { owned?: unknown }) => {
        if (cancelled || !Array.isArray(data.owned)) return;
        setOwned(new Set(data.owned.filter((v) => typeof v === "string")));
      })
      .catch(() => {
        // Best-effort — see the doc comment above.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <OwnedItemsContext.Provider value={owned}>
      {children}
    </OwnedItemsContext.Provider>
  );
}

export function useOwnedItems(): ReadonlySet<string> {
  return useContext(OwnedItemsContext);
}

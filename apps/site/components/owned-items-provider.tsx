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
 * The fetch ALWAYS fires on mount now (ADR-0418) — a prior revision skipped it for a signed-out
 * visitor by reading a server-minted hint cookie via `document.cookie`, which required that hint
 * to be readable by page JS: a same-origin auth SIGNAL any script on the page, including a
 * third-party one, could then observe for the saving of one request. The ruling moved that
 * optimization server-side instead: the hint cookie is now `HttpOnly` (invisible to
 * `document.cookie`), and `/api/cart/owned` itself short-circuits on the cookie's absence before
 * resolving a session or touching the DB (`app/api/cart/owned/route.ts`) — the cheap path for a
 * signed-out visitor is preserved, just moved behind the origin instead of in front of it. The
 * fail-open contract is unchanged: a failed/erroring fetch, or a `{owned: []}` response (no
 * session, or a stale one the route can't resolve), both leave `owned` empty — never a false
 * "owned".
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

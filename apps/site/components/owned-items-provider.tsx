"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { SESSION_HINT_COOKIE_NAME } from "@/lib/session-hint-cookie";

/**
 * The signed-in account's already-owned catalog cart-item ids (G16), fetched client-side from
 * `GET /api/cart/owned` after mount — mirrors `CartProvider`'s post-mount hydration so a public
 * marketing page stays statically generated (no per-request session read at SSR time). Starts
 * empty (a signed-out visitor's steady state) and fills in once the fetch resolves; a fetch
 * failure — offline, the route erroring — leaves it empty rather than blocking the page, since
 * the worst case is a buyer sees an un-disabled Buy button for something they already own, not a
 * broken cart.
 *
 * The fetch is gated on `SESSION_HINT_COOKIE_NAME` (CAISSON-81, ADR-0315), NOT the real better-auth
 * session cookie — that one is HttpOnly (identity/security.md) so `document.cookie` reads it as
 * absent for EVERYONE, which is the exact bug a prior "skip when signed out" attempt shipped (it
 * silently disabled owned-item marking for signed-in buyers too — the double-pay guard
 * add-to-cart-button.tsx depends on). The hint cookie is server-minted alongside the real session
 * (`lib/auth-server.ts`) specifically so this check works. FAIL-OPEN both directions: hint absent
 * → skip the fetch, `owned` stays empty (same as today's signed-out steady state — never blocks
 * the page). Hint present but the session is actually dead (stale/revoked) → the fetch still runs,
 * `/api/cart/owned` resolves no session server-side and returns `{owned: []}` — degrades to no
 * marking, never a false "owned".
 */
const OwnedItemsContext = createContext<ReadonlySet<string>>(new Set());

/** True when the non-HttpOnly hint cookie is present — a plain substring check is safe here (the
 *  value is always the literal `"1"`, never attacker-influenced free text) and avoids parsing the
 *  whole `document.cookie` string into a map for one lookup. */
function hasSessionHint(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split("; ")
    .some((entry) => entry === `${SESSION_HINT_COOKIE_NAME}=1`);
}

export function OwnedItemsProvider({ children }: { children: ReactNode }) {
  const [owned, setOwned] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!hasSessionHint()) return;
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

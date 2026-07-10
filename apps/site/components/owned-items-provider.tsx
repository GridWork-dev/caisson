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
 * Slice (b), ADR-0310: the fetch only fires when a better-auth session cookie is present, so a
 * signed-out view — every marketing-page visit is one, by far the common case — never sends the
 * wasted round trip. See `hasSessionCookie` below for the cookie name + the one caveat it's
 * written to tolerate.
 */
const OwnedItemsContext = createContext<ReadonlySet<string>>(new Set());

// The real better-auth cookie (`lib/auth-server.ts`'s `SESSION_COOKIE_NAME`), plus its
// `__Secure-` prefixed form (better-auth adds that prefix over HTTPS/production). Not imported
// from `lib/auth-server.ts` — that module pulls in `pg` + the `better-auth` server runtime, which
// a "use client" file must never bundle.
const SESSION_COOKIE_NAMES = [
  "caisson.session_token",
  "__Secure-caisson.session_token",
];

/**
 * True when a better-auth session cookie is visible on `document.cookie`. Fails toward `true`
 * (fetch) on anything indeterminate — no `document` (non-browser), or the cookie API throwing —
 * never toward silently dropping the fetch on a guess.
 *
 * Caveat: the security floor requires that cookie stay `HttpOnly` (identity/security.md), and
 * `auth-server.ts` sets it that way — so `document.cookie` can never actually observe it in this
 * deployment. This check is written against the cookie's real name so it starts gating correctly
 * the moment a readable companion hint cookie exists; today it degrades to "never observed",
 * i.e. the fetch stops firing for every visitor, not only signed-out ones. That sits inside this
 * component's own pre-existing best-effort contract (the doc comment above: worst case is a
 * stale Buy button, not a broken cart) but is a known gap — restoring the owned-items badge for
 * real signed-in buyers needs a non-HttpOnly session hint cookie minted server-side, which is
 * outside this file's scope.
 */
export function hasSessionCookie(): boolean {
  if (typeof document === "undefined") return true;
  try {
    const cookies = document.cookie.split("; ");
    return SESSION_COOKIE_NAMES.some((name) =>
      cookies.some((entry) => entry.startsWith(`${name}=`)),
    );
  } catch {
    return true;
  }
}

export function OwnedItemsProvider({ children }: { children: ReactNode }) {
  const [owned, setOwned] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!hasSessionCookie()) return;
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

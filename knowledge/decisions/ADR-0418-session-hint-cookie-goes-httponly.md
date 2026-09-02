# ADR-0418 — The session-hint cookie goes HttpOnly; the owned-items short-circuit moves to the server

- **Date:** 2026-09-01
- **Status:** Accepted (operator picker in the caisson session pane, 2026-09-01 — ask `CAI-ASK-2b`, label verbatim below)
- **Scope:** `apps/site` — `lib/auth-server.ts`, `lib/session-hint-cookie.ts`, `components/owned-items-provider.tsx`, `app/api/cart/owned/route.ts`
- **Parent:** CAISSON-81 (the G16 double-pay guard the hint exists to serve)
- **Evidence:** the code as it stood at `7d396693`, read in-session 2026-09-01
- **Tracks:** CAISSON-213 (session-hint cookie exposure)

## Context

`apps/site` mints a second cookie beside the real better-auth session token: `caisson_sess_hint`,
value `"1"`, `Secure` + `SameSite=Strict` but deliberately **not** `HttpOnly`. Its only job is to
let `components/owned-items-provider.tsx` read `document.cookie` and skip its
`GET /api/cart/owned` fetch for a signed-out visitor — the real session cookie is `HttpOnly`, so
client JS cannot distinguish signed-in from signed-out without it.

The design is honest about being a hint and not a trust boundary: every server route still resolves
the real session, and the provider fails open in both directions. What it costs is that
**auth state becomes readable by any script running on the page** — a third-party tag, an injected
script, an extension — for the saving of one request per signed-out page view. The cookie carries no
session material, so the exposure is not a token leak; it is a state disclosure, and the thing it
buys is an optimization that does not need a client-readable cookie to work.

Three code comments cite **ADR-0315** for this cookie's design. That ADR is the 2026-07-10 close-out
triage picker and says nothing about a hint cookie — the citations are dangling and have been since
they were written. This ADR is the real one.

## Decision

### Ruling 2b — "Make the hint HttpOnly + authenticated state endpoint"

1. The hint cookie is minted and cleared with `httpOnly: true`. `Secure` + `SameSite=Strict` stay,
   and it keeps deriving its expiry from `newSession.session.expiresAt` so it can never outlive the
   real session cookie.
2. `OwnedItemsProvider` stops reading `document.cookie` and always fetches on mount. The
   `hasSessionHint()` helper goes.
3. `GET /api/cart/owned` reads the hint cookie server-side and returns `{ owned: [] }` immediately
   when it is **absent**, before any session resolution or database read. The saving the client-side
   check was buying is preserved — it just happens on the server, where the cookie is readable
   without being exposed.
4. The three dangling ADR-0315 citations are repaired to point here.

The cookie's **presence** grants nothing: a request that carries it still goes through the real
`getSession()` + row-level-scoped read in `getOwnedCartItemIds()`. The short-circuit is an
optimization on the negative path only, which is why it is safe to key on a cookie the server does
not verify.

Two options were declined:

- **Keep it readable and record the exception in an ADR.** This was the analysis's own
  recommendation, on the grounds that the cookie is contentless. Declined: writing down that page
  scripts may read auth state makes the exposure permanent and quotable, to save one request.
- **Remove the cookie entirely and always fetch.** Declined: it puts a session-resolving,
  database-touching request on every signed-out marketing page view, which is the majority of
  traffic to the surface this cookie was introduced to keep cheap.

## Consequences

- A signed-out visitor now makes one `/api/cart/owned` request per page load that previously never
  fired. It is answered from the cookie jar with no session resolution and no database round-trip,
  so the cost moves from zero requests to one cheap request — deliberately, in exchange for the
  auth-state signal leaving the client.
- A stale hint left behind by a client that ignored the clearing `Set-Cookie` still costs exactly
  one full resolution that returns no owned ids. The fail-open contract is unchanged: the worst case
  stays an un-disabled Buy button for something already owned, never a false "owned".
- The provider test that asserted **zero** fetches for a signed-out render is inverted: it now pins
  that the fetch fires and that the response is what keeps `owned` empty. The old assertion would
  have been the one thing still enforcing the client-side read.
- Anything else that ever wants to branch on auth state in client JS has no cookie to read. That is
  the point, and it is a real constraint on future work on this surface.

// The name of the server-minted, HttpOnly session-HINT cookie (ADR-0418). Split into its own
// zero-dependency module so `app/api/cart/owned/route.ts` (which reads the cookie directly via
// `cookies()` to short-circuit before resolving a session) doesn't have to import `auth-server.ts`
// — which mints/clears the cookie via `sessionHintCookieHook` — just for one string literal:
// `auth-server.ts` pulls in `pg` + the full `better-auth` server SDK.
export const SESSION_HINT_COOKIE_NAME = "caisson_sess_hint";

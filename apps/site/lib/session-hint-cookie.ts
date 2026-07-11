// The name of the server-minted, non-HttpOnly session-HINT cookie (CAISSON-81, ADR-0315). Split
// into its own zero-dependency module so both the server (`auth-server.ts`, mints/clears it via
// better-auth's databaseHooks) and the client (`components/owned-items-provider.tsx`, reads it to
// gate the owned-items fetch) share ONE literal — `auth-server.ts` pulls in `pg` + `better-auth`
// server SDK and must never be imported from a "use client" component.
export const SESSION_HINT_COOKIE_NAME = "caisson_sess_hint";

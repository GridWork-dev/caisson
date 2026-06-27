# ADR-0015 — Auth library, session shape, and the auth→RLS seam

Status: proposed · 2026-06-27 (foundations track; resolves the open auth fork)

Auth is **better-auth** (operator lock): modern, TS-native, **self-hosted** (own-the-code — no
Clerk/WorkOS recurring cost the buyer inherits), framework-agnostic (fits our framework-agnostic
core), and it owns its tables **in our Drizzle schema** (ADR-0014) so sessions/users/accounts/
members are first-class rows the rest of the base joins against. Multi-tenant membership
(`member` × `role` = `owner|seat`, spec §3) is modeled with better-auth's organization plugin,
where an **organization = an `account`** (the buyer/tenant).

**Session shape + the two seams.**

1. **Same-process (control plane).** `resolveSession(req)` returns `{ userId, accountId, role }`
   straight from the better-auth server session (DB-backed session cookie: `Secure`, `HttpOnly`,
   `SameSite=Strict` per the security floor). `accountId` is the caller's **active** account
   (set on login / account-switch), and it is the only thing the data layer trusts.
2. **Cross-plane / cross-service (the RLS + execution-plane seam, arch spec §2).** A better-auth
   **JWT plugin mints an EdDSA (Ed25519) JWT** carrying `{ sub: userId, account_id, role }`,
   verified against a **cached JWKS** at the seam (control→execution plane, the buyer MCP, any
   service boundary). Asymmetric verify (`crypto.verify`), never `timingSafeEqual`.

**auth → RLS injection (the load-bearing seam).** The data layer's **only** entry is
`withTenant(db, accountId, fn)` (ADR-0005, `@caisson/tenancy-rls`): it opens a transaction,
`SET ROLE app`, `SET LOCAL app.current_account = $accountId`, runs `fn`, commits. RLS policies
read `current_setting('app.current_account')`. `accountId` is sourced **only** from the verified
session/JWT above — never from request params/body — so a forged `account_id` cannot cross
tenants, and a query that forgets `withTenant` has no `SET LOCAL` and **fails closed** (RLS
denies). No app code issues raw `db` queries on tenant tables outside `withTenant`; the lint-gate

- review enforce it.

**Webhook + MCP Bearer.** Opaque service/registry/MCP Bearer tokens (Stripe-webhook-internal,
MCP per-buyer tokens) are compared with **`crypto.timingSafeEqual`** (ADR-0002/0008); Stripe's
own webhook signature uses its HMAC scheme (ADR-0017). EdDSA licenses verify via `crypto.verify`
(ADR-0010). Three distinct comparison disciplines — never interchanged.

Rejected: Auth.js/NextAuth (framework-coupled — weak fit for the framework-agnostic core). Lucia
(the library was sunset upstream — pattern only, not a dependency). Hosted Clerk/WorkOS/Auth0
(recurring cost + vendor lock the buyer inherits; against own-the-code). Roll-your-own full auth
(large surface — sessions/OAuth/reset/2FA — better-auth gives it self-hosted while still minting
our EdDSA JWT for the seam).

Binding: `accountId` for RLS comes only from a verified session/JWT; `withTenant` is the sole
tenant-data entry; sessions ship `Secure`/`HttpOnly`/`SameSite=Strict`; the three token
disciplines (timing-safe Bearer · HMAC webhook · asymmetric license/JWT) never cross.

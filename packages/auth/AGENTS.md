# @caisson/auth — agent usage note

Provides the EdDSA-JWT account-token contract and session interface backed by better-auth (ADR-0015).

## Key surface

- Import the token-verify helper and session type from `@caisson/auth`.
- Tokens are short-lived EdDSA JWTs; the `sub` claim carries the tenant-scoped user ID that feeds Postgres RLS (passes into `withTenant` from `@caisson/tenancy-rls`).
- Never compare token strings with `===`; use `crypto.timingSafeEqual` (re-exported via `@caisson/kernel`).
- The better-auth provider config is injected at runtime — never hardcode provider URLs or client secrets in code.

## Scope

Auth boundary only. Billing, credit gating, and AI-provider keys are out of scope for this package.

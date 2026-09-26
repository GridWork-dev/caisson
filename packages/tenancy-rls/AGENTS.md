# @caisson-sh/tenancy-rls — agent usage note

Provides fail-closed multi-tenant Postgres RLS: FORCE row-level security policies, `withTenant` transaction wrapper, and a missing-filter proof that prevents cross-tenant data leaks (ADR-0005).

## Key surface

- Wrap every database transaction in `withTenant(db, accountId, async (tx) => { … })` — raw transactions outside this wrapper are rejected by the FORCE policy.
- RLS is fail-closed: a missing or empty `tenant_id` filter causes the query to return zero rows, never cross-tenant rows.
- The `accountId` originates from the verified JWT `sub` claim (see `@caisson-sh/auth`); never accept a tenant ID from an untrusted request body.
- Do not bypass `withTenant` with `SET LOCAL` or raw `SET` statements — those bypass the proof and will be flagged in review.

## Scope

Multi-tenant Postgres RLS boundary only. Auth (token verification) belongs in `@caisson-sh/auth`.

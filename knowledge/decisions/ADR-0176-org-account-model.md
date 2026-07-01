# ADR-0176 — Buyer account: organization model (multi-user tenant via `account_member`)

**Status:** accepted · 2026-06-30 (Stage-2 Stream D — operator fork lock D4) · extends ADR-0015 (better-auth,
`withTenant` sole RLS entry) / ADR-0132 (buyer sign-in) · closes the personal-account placeholder seam in
`apps/site/lib/auth.ts:23-27`. Does **not** change ADR-0005 (fail-closed RLS) — the tenant boundary is
unchanged. Append-only; supersede with a later ADR, never edit. **Tags:** `auth` `data-migration`.

## Context

The account model today is strictly **1-user = 1-account**: `apps/site/lib/auth.ts:37` hardcodes
`accountId = user.id`, `role: "owner"`. Crucially, **everything below the session layer already keys on an
opaque `account_id` string** — `withTenant(db, accountId, fn)` (`rls.ts:31`), the RLS policies,
`entitlement_grant`, `license_grant`, and both billing event mappers thread `account_id` with no FK and no
opinion on what it identifies. The model is already **org-shaped below the session**; only identity→account
resolution is 1:1. A `Role = "owner" | "seat"` type + JWT claim already exist (`session.ts:7`, `jwt.ts:17`) but
are never branched on. The operator locked **org now** (sell to teams at launch) over the smaller personal
default.

## Decision

Introduce a multi-user **organization** account model. The tenant key stays the opaque `account_id`; a new
membership table resolves which users belong to an account and with what role.

1. **New table `account_member(account_id text, user_id text, role text, created_at)`** — PK `(account_id,
user_id)`, `role ∈ {owner, seat}` (reuse the existing `Role`). This is the **only** new schema; it lands as
   a numbered, idempotent, forward-only migration through `@caisson/migrate` with RLS FORCE (fail-closed,
   ADR-0005) — the `data-migration` surface.
2. **`getSession()` resolves an active account** from `account_member` instead of `accountId = user.id`: a
   signed-in user with exactly one membership resolves to it; multiple memberships resolve to a selected
   "active account" (a signed cookie/claim), defaulting to the user's first/owned account. The
   `SessionContext.role` becomes the member's real role, not a hardcoded `"owner"`.
3. **Account creation + membership:** on first sign-in a user gets a personal account (a `account_member` row
   with `role: owner`, `account_id = user.id` — backward-compatible with every existing opaque key). An
   **owner** can create additional (org) accounts and invite users (email invite → `account_member` on accept).
4. **Wire `role` into authz:** at least the billing/entitlement-management + invite/member-management actions
   gate on `role === "owner"` (seats cannot manage billing or members). This activates the already-declared but
   dead `role` branch.
5. **Checkout `account_id`** stamps the **active** account (not the raw `user.id`) at cart→Paddle checkout, so
   purchases provision to the chosen account.

**Explicitly unchanged (zero migration):** `withTenant`, the RLS policies, `entitlement_grant`, `license_grant`,
`pricebook`, and both billing mappers — all were built against the opaque `account_id` and need no signature or
schema change. This is why org is a **zero-rework** extension, not a rebuild.

## Why

- Everything downstream already keys on `account_id`; the membership indirection is the _only_ missing layer, so
  the diff is one table + the session-resolution + a switcher UI + one authz gate.
- Backward-compatible: existing single-user accounts become an `account_member` row with `account_id = user.id`,
  so no data backfill breaks existing entitlements/licenses/credits.
- Sell-to-teams is a launch requirement (operator lock) — deferring org would force a session-layer change
  later anyway; doing it now while the surface is small is cheaper.

## Scope — build-now vs DEPLOY-class

**Build now (in-repo):** the migration, the `getSession()` resolution + active-account cookie/claim, the
create-org + invite/accept + account-switcher UI, the `role`-based authz gates, the checkout active-account
stamping, and tests (RLS-forced membership isolation; owner-vs-seat authz; single→org migration round-trip).
**DEPLOY-class:** nothing new — runs on the already-locked Railway Postgres (ADR-0115); the invite email reuses
the wired Resend/`Emailer` transport (ADR-0018/0085).

## Rejected

- **Personal (1-user=1-account) now, org later** — the smaller diff (delete a comment), but the operator sells
  to teams at launch; org is the lock.
- **A better-auth organization plugin owning its own tables** — rejected; the tenant key is our opaque
  `account_id`, and `account_member` is a 3-column table — a plugin's schema would fight the existing
  `withTenant` contract. Keep better-auth owning only user/session (ADR-0015 boundary unchanged).
- **Making `role` a richer RBAC matrix** — `{owner, seat}` is enough for launch; a permission matrix is a later
  ADR if seats need graduated capability.

## Relations

Composes with ADR-0172 (WorkOS SSO — the SSO _transport_; this ADR owns account/role _semantics_, so SCIM
directory-sync provisions into `account_member` when that lands) and ADR-0131/0132 (cart + sign-in — the active
account is the checkout + dashboard tenant). Does not touch ADR-0005 (RLS) or ADR-0015's table-ownership
boundary.

## Binding

Buyer accounts are multi-user organizations resolved through `account_member`; the opaque `account_id` stays
the tenant key (no downstream schema change); `role ∈ {owner, seat}` gates member/billing management; a
signed-in user resolves to an active account. Changing the membership model or the role set requires a
superseding ADR.

Evidence: `apps/site/lib/auth.ts:23-41`; `packages/auth/src/session.ts:7-19`; `packages/auth/src/jwt.ts:14-18`;
`packages/tenancy-rls/src/rls.ts:31-47`; `services/license/src/{entitlement-store,license-grant-store}.ts`;
recon `wf_fa542371-7e6` (D4:account-model) — operator fork lock 2026-06-30.

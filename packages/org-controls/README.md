# @caisson-sh/org-controls

Org & operator controls (Apache-2.0), kept apart from `@caisson-sh/auth` and `@caisson-sh/tenancy-rls`
so an app that needs neither SSO nor an operator plane never installs them:

- **WorkOS SSO** (`createWorkosSsoProvider`) — framework-agnostic AuthKit/SSO transport seam;
  config is injected, never read from env by the package.
- **Clerk session verification** (`createClerkSessionVerifier`, ADR-0287) — verifies a Clerk
  session token (JWT v2) against Clerk's JWKS via `@clerk/backend`, then maps the claims onto the
  kernel's `SessionContext`. Networkless when `jwtKey` is supplied. The mapping is stateless — an
  active Clerk Organization maps to `accountId`/`role`, but a caller needing the DB-authoritative
  multi-account/seat resolution should route the verified `userId` through `@caisson-sh/auth`'s
  `resolveUserAccounts`/`selectActiveAccount` instead.
- **Owner-gated membership** (`listAccountMembers` / `addAccountMember` / `assertCanManageMembers`)
  — the MANAGE half of the multi-user account model. User **session resolution**
  (`resolveUserAccounts` / `ensurePersonalAccount` / `selectActiveAccount`) stays in
  `@caisson-sh/auth` — it runs on every login and must never sit behind this package.
- **Admin-write RLS layer** (`withAdminWrite` + the policy/role builders) — the cross-tenant
  write role the operator control plane mutates through, DB-separated from the tenant `app` role.
  Tenant isolation (`withTenant` / `withUser`) stays in `@caisson-sh/tenancy-rls`.
- **Feature gate** (`holdsOrgControls`) — a fail-closed predicate an app can use to gate its own
  org surfaces (e.g. `/dashboard/members`) on a granted feature id.

Composes DOWN onto `@caisson-sh/auth`, `@caisson-sh/tenancy-rls`, and `@caisson-sh/kernel`.

## Entry points

- `.` — the full surface, server-side (the SSO/Clerk transports and the tenant-scoped member
  writes all need a network or a database session).
- `./browser` — `assertCanManageMembers` alone, safe inside a client bundle, so a UI can render the
  same owner gate the server enforces instead of re-implementing it. Every name on `./browser` is
  also on `.`.

# @caisson/org-controls

Commercial ($249, ADR-0257). Org & operator controls, carved out of the open Base so the
Apache-2.0 substrate stays as small as the org features allow:

- **WorkOS SSO** (`createWorkosSsoProvider`) — framework-agnostic AuthKit/SSO transport seam;
  config is injected, never read from env by the package.
- **Owner-gated membership** (`listAccountMembers` / `addAccountMember` / `assertCanManageMembers`)
  — the MANAGE half of the multi-user account model. Buyer **session resolution**
  (`resolveUserAccounts` / `ensurePersonalAccount` / `selectActiveAccount`) stays in the open
  `@caisson/auth` — it runs on every login and must never sit behind this entitlement.
- **Admin-write RLS layer** (`withAdminWrite` + the policy/role builders) — the cross-tenant
  write role the operator control plane mutates through, DB-separated from the buyer `app` role.
  Buyer tenant isolation (`withTenant` / `withUser`) stays in the open `@caisson/tenancy-rls`.
- **Entitlement gate** (`holdsOrgControls`) — the fail-closed predicate gating the product's own
  surfaces (e.g. `/dashboard/members`).

Composes DOWN onto `@caisson/auth`, `@caisson/tenancy-rls`, and `@caisson/kernel` (commercial → open).

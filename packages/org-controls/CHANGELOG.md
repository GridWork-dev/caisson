# @caisson/org-controls

## 0.2.0

### Minor Changes

- 0c883ae: The org module carve: ONE merged commercial package
  `@caisson/org-controls` at $249 (tier `paid`, priceCents 24900, `LicenseRef-Caisson-Commercial`).
  It absorbs three surfaces out of the open Base:

  - **WorkOS SSO** (`createWorkosSsoProvider`) from `@caisson/auth` (zero live consumers).
  - The **owner-gated MANAGE membership** surface (`listAccountMembers` / `addAccountMember` /
    `assertCanManageMembers`) from `@caisson/auth`. The login-critical session-resolution half
    (`resolveUserAccounts` / `ensurePersonalAccount` / `selectActiveAccount`) STAYS in open
    `@caisson/auth` — it runs on every buyer login.
  - The **full 6-export admin-write RLS layer** (`withAdminWrite` / `buildAdminWritePolicySql` /
    `buildAdminSelectPolicySql` / `ADMIN_WRITE_ROLE` / `ADMIN_WRITE_ROLE_BOOTSTRAP_SQL` /
    `AdminWritePolicyOptions`) from `@caisson/tenancy-rls`. The fail-closed privileged-role guard is
    DUPLICATED into org-controls (file-private) rather than exported, keeping the open tenancy-rls API
    unchanged. Buyer tenant isolation (`withTenant` / `withUser` / `buildTenantPolicySql`) stays open.

  Plus a new fail-closed `/dashboard/members` entitlement gate (`holdsOrgControls`) — the surface is
  gated on the org-controls entitlement, denying to an upsell state. `@caisson/auth` and
  `@caisson/tenancy-rls` stay Apache-2.0 at their now-narrower surfaces (no OPEN_BASE_NAMES change).

### Patch Changes

- Updated dependencies [b791198]
- Updated dependencies [0c883ae]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
  - @caisson/auth@0.3.0
  - @caisson/kernel@0.4.2
  - @caisson/tenancy-rls@0.4.0

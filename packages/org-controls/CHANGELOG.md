# @caisson/org-controls

## 0.4.2

### Patch Changes

- Updated dependencies [498b279]
- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/tenancy-rls@0.6.1
  - @caisson/kernel@0.10.0
  - @caisson/auth@0.4.5

## 0.4.1

### Patch Changes

- 87275f6: Replace ESLint and Prettier with oxlint and oxfmt.

  Linting and formatting now run on the oxc toolchain. The rule floor is unchanged: the same
  no-any, no-console, type-only-import and provider-SDK-boundary rules are enforced, at the same
  severities, and formatting keeps the settings the previous formatter used. Every package here is
  touched by the dependency removal or by the one-pass reformat, so each takes a patch bump; no
  runtime behaviour changes.

  For anyone consuming the shared configuration: the lint config package is renamed, and the lint
  and format commands changed.

- Updated dependencies [f669d4a]
- Updated dependencies [b0e66b6]
- Updated dependencies [2609293]
- Updated dependencies [87275f6]
  - @caisson/kernel@0.9.0
  - @caisson/tenancy-rls@0.6.0
  - @caisson/auth@0.4.4

## 0.4.0

### Minor Changes

- dff76d9: The package gains a browser-safe `./browser` entry point carrying `assertCanManageMembers`, so a
  client bundle can render the owner-only gate using the exact function the server enforces instead
  of a second copy of the rule. The gate now lives in its own internal module with no database, SSO,
  or Node dependencies; the main entry is unchanged and keeps the full surface, every public export
  keeps its name and shape, and every browser-entry export is also available on the main entry. The
  site's org-controls interactive demo now runs that real gate instead of a hand-maintained copy.

### Patch Changes

- Updated dependencies [7d74f8f]
  - @caisson/kernel@0.8.0
  - @caisson/auth@0.4.3
  - @caisson/tenancy-rls@0.5.8

## 0.3.6

### Patch Changes

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0
  - @caisson/auth@0.4.2
  - @caisson/tenancy-rls@0.5.7

## 0.3.5

### Patch Changes

- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
  - @caisson/kernel@0.6.0
  - @caisson/auth@0.4.1
  - @caisson/tenancy-rls@0.5.6

## 0.3.4

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
- Updated dependencies [b8b14b4]
  - @caisson/auth@0.4.0
  - @caisson/kernel@0.5.3
  - @caisson/tenancy-rls@0.5.5

## 0.3.3

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/auth@0.3.5
  - @caisson/tenancy-rls@0.5.4

## 0.3.2

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/auth@0.3.4
  - @caisson/tenancy-rls@0.5.3

## 0.3.1

### Patch Changes

- baaa4fc: Dependency safe-batch bump: ai-kit's Next.js pin moves onto the shared catalog version and org-controls upgrades to Clerk backend v3; no behavior change.
- Updated dependencies [a8696cf]
- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/auth@0.3.3
  - @caisson/kernel@0.5.0
  - @caisson/tenancy-rls@0.5.2

## 0.3.0

### Minor Changes

- 230f02a: Teammates invited to an Org Controls account can now actually reach it: the dashboard has a new
  account switcher for anyone who belongs to more than one account, so an invited seat is no longer
  stuck on their own personal account with no way to find the org they were added to. The Members
  page also gains a self-serve "Remove" control for the account owner — offboarding a departed
  teammate no longer requires contacting support. An owner can never accidentally remove themselves
  or another owner through this control.
- a0aa9a3: New Clerk session-verification driver, beside the existing WorkOS SSO transport. Verifies a Clerk
  session token against Clerk's JWKS (networkless when a public key is configured) and maps the claims
  onto the same session shape the rest of the product depends on — a Clerk-authenticated buyer resolves
  through the identical seam as a WorkOS or password-based one. An active Clerk Organization maps to an
  account and role; a personal (non-Organization) session falls back to the product's own single-user
  account convention.

### Patch Changes

- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
  - @caisson/kernel@0.4.3
  - @caisson/auth@0.3.2
  - @caisson/tenancy-rls@0.5.1

## 0.2.1

### Patch Changes

- Updated dependencies [8c53ca3]
- Updated dependencies
  - @caisson/tenancy-rls@0.5.0
  - @caisson/auth@0.3.1

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

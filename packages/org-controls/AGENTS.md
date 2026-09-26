# @caisson-sh/org-controls — agent notes

Org/operator controls module (Apache-2.0). Import surface:

- `createWorkosSsoProvider(config)` → `{ authorizationUrl, exchangeCode }`. Inject config; the
  package never reads `WORKOS_*` env.
- `createClerkSessionVerifier(config)` → `{ verifySession(token) }` resolving a kernel
  `SessionContext`; `verifyClerkSessionClaims` (throws `AuthnError`) and `clerkClaimsToSessionContext`
  (pure) are the two composed halves, exported separately for direct testing. Inject `jwtKey` or
  `secretKey`; the package never reads `CLERK_*` env. The org-claim mapping is a stateless,
  best-effort signal — it does not consult `account_member`.
- `listAccountMembers(db, accountId)` / `addAccountMember(db, actorRole, accountId, userId, role?)`
  / `assertCanManageMembers(role)` — the owner-gated MANAGE surface. Owner-only writes; `actorRole`
  comes from the verified session, never a request param.
- `withAdminWrite(db, fn)` + `buildAdminWritePolicySql` / `buildAdminSelectPolicySql` /
  `ADMIN_WRITE_ROLE` / `ADMIN_WRITE_ROLE_BOOTSTRAP_SQL` / `AdminWritePolicyOptions` — the
  cross-tenant operator-write RLS seam. One target account per call; the caller filters + dual-logs.
- `holdsOrgControls(activeEntitlementIds)` + `ORG_CONTROLS_ENTITLEMENT_ID` — the fail-closed gate
  predicate. Pass ONLY active grants; deny on any read error.

**Boundary:** user session resolution stays in `@caisson-sh/auth`; tenant isolation
(`withTenant`/`withUser`) stays in `@caisson-sh/tenancy-rls`. Never move those into this package.

**Entry points:** `.` is the full server-side surface; `./browser` (ADR-0396) is the browser-safe
subset — `assertCanManageMembers` from `src/gate.ts`, and nothing else. A client bundle imports
`./browser`, never `.`. A module joins `./browser` only if its whole graph passes the static
source-graph walk in `src/browser-safety.test.ts`, and every `./browser` name must also exist on
`.`. Note what the walk is checking for here: this package reaches **zero** `node:` builtins, so
the blocker is the EXTERNAL frontier — `@clerk/backend` (clerk.ts) and `pg` (via
`@caisson-sh/tenancy-rls` in membership.ts). `Role` comes from `@caisson-sh/auth` as a statement-level
`import type`; making it a value import would taint the entry through that package's `jwt.ts`.

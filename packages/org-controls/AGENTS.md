# @caisson/org-controls — agent notes

Commercial org/operator module (ADR-0257 §1.3). Import surface:

- `createWorkosSsoProvider(config)` → `{ authorizationUrl, exchangeCode }`. Inject config; the
  package never reads `WORKOS_*` env.
- `listAccountMembers(db, accountId)` / `addAccountMember(db, actorRole, accountId, userId, role?)`
  / `assertCanManageMembers(role)` — the owner-gated MANAGE surface. Owner-only writes; `actorRole`
  comes from the verified session, never a request param.
- `withAdminWrite(db, fn)` + `buildAdminWritePolicySql` / `buildAdminSelectPolicySql` /
  `ADMIN_WRITE_ROLE` / `ADMIN_WRITE_ROLE_BOOTSTRAP_SQL` / `AdminWritePolicyOptions` — the
  cross-tenant operator-write RLS seam. One target account per call; the caller filters + dual-logs.
- `holdsOrgControls(activeEntitlementIds)` + `ORG_CONTROLS_ENTITLEMENT_ID` — the fail-closed gate
  predicate. Pass ONLY active grants; deny on any read error.

**Boundary:** buyer session resolution stays in `@caisson/auth`; buyer tenant isolation
(`withTenant`/`withUser`) stays in `@caisson/tenancy-rls`. Never move those into this package.

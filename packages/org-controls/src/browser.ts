// The browser-safe entry (`@caisson-sh/org-controls/browser`, ADR-0396): the owner-only authz gate,
// and only that. ADDITIVE — the `.` barrel is untouched and stays the full node-capable surface;
// every name here is also on `.` (the subset test in browser-safety.test.ts pins that direction).
//
// DELIBERATELY EXCLUDED, so the next reader does not "complete" this entry:
//   - membership.ts (`listAccountMembers`/`addAccountMember`/`removeAccountMember`) — every one is
//     a real `withTenant` Postgres transaction, so the module value-imports @caisson-sh/tenancy-rls
//     and through it the `pg` driver. A client bundle has no database session to run them in.
//   - clerk.ts — verifies a session token against Clerk's JWKS through the `@clerk/backend` SDK.
//   - workos.ts — a live api.workos.com code exchange carrying the WorkOS client secret.
//   - admin-write.ts — the cross-tenant `admin_write` RLS seam. Its policy BUILDERS are pure
//     string emitters and would pass the walk, but `withAdminWrite` on the same module is a
//     transaction; an operator control plane is server-side by definition, so nothing browser-side
//     wants them and admission waits for a consumer (ADR-0396's admission rule).
//   - entitlement.ts (`holdsOrgControls`) — dependency-free and would pass the walk today; it stays
//     off for the same reason: the gate it feeds runs server-side, and an entry point is a
//     permanent published promise.
// ponytail: one export is the honest size of this entry — widen it when a consumer needs more, the
// walk in browser-safety.test.ts proves each candidate the same way.
export * from "./gate.ts";

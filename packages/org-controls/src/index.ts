// @caisson-sh/org-controls (ADR-0257 §1.3): WorkOS SSO sign-in, a Clerk
// session-verification driver, the owner-gated multi-user membership surface, the cross-tenant
// admin-write RLS layer, and the entitlement predicate that gates the product's own surfaces. The
// open @caisson-sh/auth keeps adopter session resolution; @caisson-sh/tenancy-rls keeps adopter tenant isolation.
export { createWorkosSsoProvider } from "./workos.ts";
export type {
  WorkosSsoConfig,
  WorkosSsoProfile,
  WorkosSsoProvider,
} from "./workos.ts";
export {
  clerkClaimsToSessionContext,
  createClerkSessionVerifier,
  verifyClerkSessionClaims,
} from "./clerk.ts";
export type {
  ClerkSessionClaims,
  ClerkSessionConfig,
  ClerkSessionVerifier,
} from "./clerk.ts";
export {
  addAccountMember,
  assertCanManageMembers,
  listAccountMembers,
  removeAccountMember,
} from "./membership.ts";
export {
  ADMIN_WRITE_ROLE,
  ADMIN_WRITE_ROLE_BOOTSTRAP_SQL,
  buildAdminSelectPolicySql,
  buildAdminWritePolicySql,
  withAdminWrite,
} from "./admin-write.ts";
export type { AdminWritePolicyOptions } from "./admin-write.ts";
export {
  ORG_CONTROLS_ENTITLEMENT_ID,
  ORG_CONTROLS_MODULE_ID,
  holdsOrgControls,
} from "./entitlement.ts";

// @caisson/service-license — Merchant-of-Record billing webhook + idempotent credit grants + the
// reference-counted account-entitlement store/resolver (grant · revoke · refund-clawback) + the
// Ed25519 offline-license ISSUER HTTP surface (P6, ADR-0089/0017/0071/0110/0113). A gated
// `invoice.paid` grants cycle credits + the plan's subscription entitlement grants; a one-time
// `purchase.completed` grants its credits + one_time entitlement grants; `subscription.canceled`
// immediately soft-revokes that subscription's grants; `refund.completed` soft-revokes the purchase's
// grants and claws back ONLY unspent credits. `resolveAccountEntitlements` expands an account's ACTIVE
// purchased ids to member slugs against the registry index; the lazy, bearer-gated `POST /issue`
// (createApp/startServer) resolves an account's entitlements and signs them into a license token via
// `@caisson/license-issue`, then PERSISTS it via `license-grant-store.ts` — `POST /issue` is idempotent
// per (accountId, major): a later call re-serves the stored token rather than re-minting.
export { applyBillingEvent } from "./apply-billing-event.ts";
export { handleBillingWebhook } from "./webhook.ts";
export type { BillingWebhookResult } from "./webhook.ts";
export {
  ENTITLEMENT_SCHEMA_SQL,
  ENTITLEMENT_GRANT_MIGRATION_SQL,
  ENTITLEMENT_ADMIN_COMP_MIGRATION_SQL,
  grantEntitlements,
  readEntitlements,
  revokeSubscriptionGrants,
  revokePurchaseGrants,
  grantAdminComp,
  revokeAdminComp,
} from "./entitlement-store.ts";
export type {
  GrantEntitlementsInput,
  GrantSource,
  RevokeSubscriptionInput,
  RevokePurchaseInput,
  GrantAdminCompInput,
  RevokeAdminCompInput,
} from "./entitlement-store.ts";

// ADR-0220 — the operator mutation surface (four locked actions) + its queryable audit-log half.
export {
  ADMIN_ACTION_LOG_SCHEMA_SQL,
  ADMIN_ACTIONS,
  AdminActionSchema,
  insertAdminActionLog,
  readAdminActionLog,
} from "./admin-audit-log.ts";
export type {
  AdminAction,
  AdminActionLogInput,
  AdminActionLogRow,
} from "./admin-audit-log.ts";
export {
  ADMIN_MUTATION_PROVISION_SQL,
  GrantEntitlementBody,
  RevokeEntitlementBody,
  AdjustCreditsBody,
  ReissueLicenseBody,
  grantEntitlementAdmin,
  revokeEntitlementAdmin,
  adjustCreditsAdmin,
  reissueLicenseAdmin,
} from "./admin-mutations.ts";
export type {
  AdminMutationDeps,
  ReissueProxyResult,
  GrantEntitlementInput,
  RevokeEntitlementInput,
  AdjustCreditsInput,
  ReissueLicenseInput,
  EntitlementMutationResult,
  CreditAdjustResult,
  ReissueResult,
} from "./admin-mutations.ts";
export { resolveAccountEntitlements } from "./resolve-entitlements.ts";
export {
  LICENSE_GRANT_SCHEMA_SQL,
  readLicenseGrant,
  storeLicenseGrant,
} from "./license-grant-store.ts";
export type {
  LicenseGrantRecord,
  StoreLicenseGrantInput,
} from "./license-grant-store.ts";
export { createApp, type IssueAppDeps } from "./app.ts";
export { startServer, type StartServerOptions } from "./server.ts";
export {
  findDiscordUserIds,
  loadDiscordNotifyConfig,
  notifyDiscordGrant,
} from "./discord-notify.ts";
export type {
  DiscordGrantPush,
  DiscordNotifyConfig,
} from "./discord-notify.ts";
export {
  RATE_LIMIT_SCHEMA_SQL,
  DEFAULT_RATE_LIMIT,
  checkRateLimit,
  setAccountRateLimit,
} from "./rate-limit-store.ts";
export type { RateLimitConfig, RateLimitDecision } from "./rate-limit-store.ts";
export { createRateLimitHook } from "./rate-limit-hook.ts";
export type { RateLimitHookDeps } from "./rate-limit-hook.ts";

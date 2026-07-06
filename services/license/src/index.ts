// @caisson/service-license — Merchant-of-Record billing webhook + idempotent credit grants + the
// reference-counted account-entitlement store/resolver (grant · revoke · refund-clawback) + the
// Ed25519 offline-license ISSUER HTTP surface (ADR-0089/0017/0071/0110/0113). A gated
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
  ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL,
  ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL,
  ENTITLEMENT_ADMIN_COMP_MIGRATION_SQL,
  grantEntitlements,
  readEntitlements,
  revokeSubscriptionGrants,
  revokePurchaseGrants,
  revokePurchaseLineGrants,
  grantAdminComp,
  revokeAdminComp,
  computeUpdatesWindows,
  extendUpdatesWindow,
} from "./entitlement-store.ts";
export type {
  GrantEntitlementsInput,
  GrantSource,
  RevokeSubscriptionInput,
  RevokePurchaseInput,
  RevokePurchaseLineInput,
  GrantAdminCompInput,
  RevokeAdminCompInput,
  ExtendUpdatesWindowInput,
} from "./entitlement-store.ts";

// ADR-0220 — the operator mutation surface + its queryable audit-log half. ADR-0225 adds the fifth
// action `purchase_revoke` (paid one-time revoke + bounded claw + edge deny-set) and its migration.
export {
  ADMIN_ACTION_LOG_SCHEMA_SQL,
  ADMIN_ACTION_LOG_ACTION_MIGRATION_SQL,
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
  LICENSE_REVOCATION_SCHEMA_SQL,
  recordLicenseRevocations,
  readDenySet,
} from "./license-revocation-store.ts";
export type { RecordLicenseRevocationsInput } from "./license-revocation-store.ts";
export {
  ADMIN_MUTATION_PROVISION_SQL,
  GrantEntitlementBody,
  RevokeEntitlementBody,
  AdjustCreditsBody,
  ReissueLicenseBody,
  RevokePurchaseBody,
  grantEntitlementAdmin,
  revokeEntitlementAdmin,
  adjustCreditsAdmin,
  reissueLicenseAdmin,
  revokePurchaseAdmin,
  wormAnchorAccount,
} from "./admin-mutations.ts";
export type {
  AdminMutationDeps,
  ReissueProxyResult,
  GrantEntitlementInput,
  RevokeEntitlementInput,
  AdjustCreditsInput,
  ReissueLicenseInput,
  PurchaseRevokeInput,
  EntitlementMutationResult,
  CreditAdjustResult,
  ReissueResult,
  PurchaseRevokeResult,
  WormStatus,
} from "./admin-mutations.ts";
export { resolveAccountEntitlements } from "./resolve-entitlements.ts";
export {
  LICENSE_GRANT_SCHEMA_SQL,
  readLicenseGrant,
  storeLicenseGrant,
  updateLicenseGrantToken,
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
  createRateLimitHook,
} from "@caisson/rate-limit";
export type {
  RateLimitConfig,
  RateLimitDecision,
  RateLimitHookDeps,
} from "@caisson/rate-limit";

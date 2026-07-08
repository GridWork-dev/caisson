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
  RENEWAL_EXTENSION_SCHEMA_SQL,
  grantEntitlements,
  readEntitlements,
  readOneTimeEntitlements,
  upsertSubscriptionGrants,
  reconcileCoverageGrants,
  COVERAGE_MIRROR_LINE_ITEM,
  revokeSubscriptionGrants,
  revokePurchaseGrants,
  revokePurchaseLineGrants,
  grantAdminComp,
  revokeAdminComp,
  computeUpdatesWindows,
  extendUpdatesWindow,
  reverseRenewalExtensions,
} from "./entitlement-store.ts";
export type {
  GrantEntitlementsInput,
  GrantSource,
  UpsertSubscriptionGrantsInput,
  RevokeSubscriptionInput,
  RevokePurchaseInput,
  RevokePurchaseLineInput,
  GrantAdminCompInput,
  RevokeAdminCompInput,
  ExtendUpdatesWindowInput,
  ReverseRenewalExtensionsInput,
} from "./entitlement-store.ts";

// ADR-0293 — subscription-lifecycle status (G13/G14) + append-only order/invoice history (G26).
export {
  SUBSCRIPTION_STATUS_SCHEMA_SQL,
  ORDER_RECORD_SCHEMA_SQL,
  upsertSubscriptionStatus,
  cancelSubscriptionStatus,
  readSubscriptionStatuses,
  insertOrderRecord,
  refundOrderRecord,
  readOrderRecords,
} from "./subscription-history-store.ts";
export type {
  UpsertSubscriptionStatusInput,
  SubscriptionStatusRow,
  InsertOrderRecordInput,
  OrderRecordRow,
} from "./subscription-history-store.ts";

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
// The eval-application table (ADR-0274/0280 verified time-boxed eval licenses). Schema ONLY — the
// operator-gated DEPLOY provisioning path (mirroring how LICENSE_GRANT_SCHEMA_SQL /
// LICENSE_REVOCATION_SCHEMA_SQL are consumed) applies this; the store functions stay internal
// because nothing outside this service writes eval_application rows.
export { EVAL_APPLICATION_SCHEMA_SQL } from "./eval-store.ts";
export {
  ADMIN_MUTATION_PROVISION_SQL,
  GrantEntitlementBody,
  RevokeEntitlementBody,
  AdjustCreditsBody,
  ReissueLicenseBody,
  RevokePurchaseBody,
  FirstMintLicenseBody,
  ResendPurchaseEmailBody,
  grantEntitlementAdmin,
  revokeEntitlementAdmin,
  adjustCreditsAdmin,
  reissueLicenseAdmin,
  revokePurchaseAdmin,
  firstMintLicenseAdmin,
  resendPurchaseEmailAdmin,
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
  FirstMintLicenseInput,
  ResendPurchaseEmailInput,
  EntitlementMutationResult,
  CreditAdjustResult,
  ReissueResult,
  PurchaseRevokeResult,
  FirstMintResult,
  ResendPurchaseEmailResult,
  WormStatus,
} from "./admin-mutations.ts";
export { resolveEmailer, notifyPurchaseEmail } from "./email-notify.ts";
export type { PurchaseEmailNotice, PurchaseEmailLine } from "./email-notify.ts";
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

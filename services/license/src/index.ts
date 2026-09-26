// @caisson/service-license — Merchant-of-Record billing webhook + idempotent credit grants + the
// reference-counted account-entitlement store/resolver (grant · revoke · refund-clawback) + the
// Ed25519 offline-license ISSUER HTTP surface (ADR-0089/0017/0071/0110/0113). A gated
// `invoice.paid` grants cycle credits + the plan's subscription entitlement grants; a one-time
// `purchase.completed` grants its credits + one_time entitlement grants; `subscription.canceled`
// immediately soft-revokes that subscription's grants; `refund.completed` soft-revokes the purchase's
// grants and claws back ONLY unspent credits. The lazy, bearer-gated `POST /issue`
// (createApp/startServer) resolves an account's entitlements and signs them into a license token via
// `@caisson/license-issue`, then PERSISTS it via `license-grant-store.ts` — `POST /issue` is idempotent
// per (accountId, major): a later call re-serves the stored token rather than re-minting.
export {
  ENTITLEMENT_SCHEMA_SQL,
  ENTITLEMENT_GRANT_MIGRATION_SQL,
  ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL,
  ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL,
  ENTITLEMENT_GRANT_CHARGED_AMOUNT_MIGRATION_SQL,
  ENTITLEMENT_GRANT_REFUNDED_AMOUNT_MIGRATION_SQL,
  ENTITLEMENT_ADMIN_COMP_MIGRATION_SQL,
  RENEWAL_EXTENSION_SCHEMA_SQL,
  RENEWAL_EXTENSION_MONTHS_MIGRATION_SQL,
  grantEntitlements,
  revokePurchaseGrants,
  extendUpdatesWindow,
  recordLineRefund,
  netCharged,
} from "./entitlement-store.ts";

// ADR-0293 — subscription-lifecycle status (G13/G14) + append-only order/invoice history (G26).
// ADR-0315 adds `ORDER_RECORD_DISCOUNT_MIGRATION_SQL` (the affiliate-attribution column).
export {
  SUBSCRIPTION_STATUS_SCHEMA_SQL,
  ORDER_RECORD_SCHEMA_SQL,
  ORDER_RECORD_SUBSCRIPTION_LINK_MIGRATION_SQL,
  ORDER_RECORD_DISCOUNT_MIGRATION_SQL,
  upsertSubscriptionStatus,
  cancelSubscriptionStatus,
  insertOrderRecord,
  refundOrderRecord,
} from "./subscription-history-store.ts";

// ADR-0315 — the affiliate program store: minted-code registry + commission report.
export {
  AFFILIATE_CODE_SCHEMA_SQL,
  readAffiliateReport,
} from "./affiliate-store.ts";
export type {
  AffiliateReport,
  AffiliateReportEntry,
  AffiliateReportOrder,
} from "./affiliate-store.ts";

// ADR-0220 — the operator mutation surface + its queryable audit-log half. ADR-0225 adds the fifth
// action `purchase_revoke` (paid one-time revoke + bounded claw + edge deny-set) and its migration.
export {
  ADMIN_ACTION_LOG_SCHEMA_SQL,
  ADMIN_ACTION_LOG_ACTION_MIGRATION_SQL,
  insertAdminActionLog,
  readAdminActionLog,
} from "./admin-audit-log.ts";
export type { AdminAction, AdminActionLogRow } from "./admin-audit-log.ts";
export {
  ADMIN_MUTATION_PROVISION_SQL,
  GrantEntitlementBody,
  RevokeEntitlementBody,
  AdjustCreditsBody,
  ReissueLicenseBody,
  RevokePurchaseBody,
  FirstMintLicenseBody,
  ResendPurchaseEmailBody,
  RotateLicenseBody,
  SetSystemModeBody,
  MintAffiliateCodeBody,
  grantEntitlementAdmin,
  revokeEntitlementAdmin,
  adjustCreditsAdmin,
  reissueLicenseAdmin,
  revokePurchaseAdmin,
  firstMintLicenseAdmin,
  resendPurchaseEmailAdmin,
  rotateLicenseAdmin,
  mintAffiliateCodeAdmin,
  readSystemMode,
  setSystemModeAdmin,
  wormAnchorAccount,
} from "./admin-mutations.ts";
export type {
  AdminMutationDeps,
  ReissueProxyResult,
  WormStatus,
} from "./admin-mutations.ts";
export {
  CHECKOUT_ABANDONMENT_SCHEMA_SQL,
  CHECKOUT_ABANDONMENT_NOTICE_SCHEMA_SQL,
  recordCheckoutAbandonment,
} from "./checkout-abandonment-store.ts";
export {
  LICENSE_GRANT_SCHEMA_SQL,
  storeLicenseGrant,
} from "./license-grant-store.ts";

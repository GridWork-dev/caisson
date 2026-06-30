// @caisson/service-license — Merchant-of-Record billing webhook + idempotent credit grants + the
// reference-counted entitlement-grant store/resolver (P6, ADR-0089/0017/0071/0109). A gated
// `invoice.paid` grants cycle credits + the plan's subscription entitlement grants; a one-time
// `purchase.completed` grants its credits + one_time entitlement grants; `subscription.canceled`
// immediately soft-revokes that subscription's grants; `refund.completed` soft-revokes the purchase's
// grants and claws back ONLY unspent credits. `resolveAccountEntitlements` expands an account's ACTIVE
// purchased ids to member slugs against the registry index. The Ed25519 license issuer lands in a
// follow-on Bucket-B slice.
export { applyBillingEvent } from "./apply-billing-event.ts";
export { handleBillingWebhook } from "./webhook.ts";
export type { BillingWebhookResult } from "./webhook.ts";
export {
  ENTITLEMENT_SCHEMA_SQL,
  ENTITLEMENT_GRANT_MIGRATION_SQL,
  grantEntitlements,
  readEntitlements,
  revokeSubscriptionGrants,
  revokePurchaseGrants,
} from "./entitlement-store.ts";
export type {
  GrantEntitlementsInput,
  GrantSource,
  RevokeSubscriptionInput,
  RevokePurchaseInput,
} from "./entitlement-store.ts";
export { resolveAccountEntitlements } from "./resolve-entitlements.ts";

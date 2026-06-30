// @caisson/service-license — Merchant-of-Record billing webhook + idempotent credit grants + the
// reference-counted account-entitlement store/resolver (grant · revoke · refund-clawback) + the
// Ed25519 offline-license ISSUER HTTP surface (P6, ADR-0089/0017/0071/0110/0113). A gated
// `invoice.paid` grants cycle credits + the plan's subscription entitlement grants; a one-time
// `purchase.completed` grants its credits + one_time entitlement grants; `subscription.canceled`
// immediately soft-revokes that subscription's grants; `refund.completed` soft-revokes the purchase's
// grants and claws back ONLY unspent credits. `resolveAccountEntitlements` expands an account's ACTIVE
// purchased ids to member slugs against the registry index; the lazy, bearer-gated `POST /issue`
// (createApp/startServer) resolves an account's entitlements and signs them into a license token via
// `@caisson/license-issue`.
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
export { createApp, type IssueAppDeps } from "./app.ts";
export { startServer, type StartServerOptions } from "./server.ts";
export {
  RATE_LIMIT_SCHEMA_SQL,
  DEFAULT_RATE_LIMIT,
  checkRateLimit,
  setAccountRateLimit,
} from "./rate-limit-store.ts";
export type { RateLimitConfig, RateLimitDecision } from "./rate-limit-store.ts";
export { createRateLimitHook } from "./rate-limit-hook.ts";
export type { RateLimitHookDeps } from "./rate-limit-hook.ts";

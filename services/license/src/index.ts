// @caisson/service-license — Merchant-of-Record billing webhook + idempotent credit grants + the
// account-entitlement store/resolver (P6, ADR-0089/0017/0071). A gated `invoice.paid` grants both the
// cycle credits and the plan's entitlements; `resolveAccountEntitlements` expands an account's stored
// purchased ids to member slugs against the registry index. The Ed25519 license issuer lands in a
// follow-on Bucket-B slice.
export { applyBillingEvent } from "./apply-billing-event.ts";
export { handleBillingWebhook } from "./webhook.ts";
export type { BillingWebhookResult } from "./webhook.ts";
export {
  ENTITLEMENT_SCHEMA_SQL,
  grantEntitlements,
  readEntitlements,
} from "./entitlement-store.ts";
export type { GrantEntitlementsInput } from "./entitlement-store.ts";
export { resolveAccountEntitlements } from "./resolve-entitlements.ts";
export {
  RATE_LIMIT_SCHEMA_SQL,
  DEFAULT_RATE_LIMIT,
  checkRateLimit,
  setAccountRateLimit,
} from "./rate-limit-store.ts";
export type { RateLimitConfig, RateLimitDecision } from "./rate-limit-store.ts";
export { createRateLimitHook } from "./rate-limit-hook.ts";
export type { RateLimitHookDeps } from "./rate-limit-hook.ts";

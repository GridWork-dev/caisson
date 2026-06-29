// @caisson/service-license — Merchant-of-Record billing webhook + idempotent credit grants (P6,
// ADR-0089/0017). Hosts the subscription cycle->grant mapper; the Ed25519 license issuer + entitlement
// resolver land in follow-on Bucket-B slices.
export { applyBillingEvent } from "./apply-billing-event.ts";
export { handleBillingWebhook } from "./webhook.ts";
export type { BillingWebhookResult } from "./webhook.ts";

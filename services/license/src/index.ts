// @caisson/service-license — Merchant-of-Record billing webhook + idempotent credit grants + the
// account-entitlement store/resolver + the Ed25519 offline-license ISSUER HTTP surface (P6,
// ADR-0089/0017/0071/0108). A gated `invoice.paid` grants both the cycle credits and the plan's
// entitlements; `resolveAccountEntitlements` expands an account's stored purchased ids to member slugs
// against the registry index; the lazy, bearer-gated `POST /issue` (createApp/startServer) resolves an
// account's entitlements and signs them into a license token via `@caisson/license-issue`.
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
export { createApp, type IssueAppDeps } from "./app.ts";
export { startServer, type StartServerOptions } from "./server.ts";

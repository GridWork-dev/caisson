# @caisson/billing — agent usage note

The OPEN billing seam (Apache-2.0): raw-body HMAC webhook signature verification (`verifyStripeWebhook`,
`verifyPaddleWebhook`, `verifyLemonSqueezyWebhook`, `verifyPolarWebhook` — no SDK for any of them, all
hand-rolled), the provider-agnostic `BillingProvider` port + every provider's config TYPE, and the typed
`DomainBillingEvent` schema. The checkout-driver FACTORIES (`createStripeBilling` / `createPaddleBilling`
/ `createLemonSqueezyBilling` / `createPolarBilling`), the provider→`DomainBillingEvent` parsers, and the
webhook idempotency live in the commercial `@caisson/billing-orchestration` (carve).

## Key surface

- Webhook handlers MUST pass the raw request body (not parsed JSON) to the HMAC verifier.
- The `BillingProvider` interface is the only surface bundles touch; no provider-specific type
  escapes the seam — every driver maps onto the same `DomainBillingEvent` union.
- The port + config types + `DomainBillingEvent` are OPEN contracts so the free-floor demo (apps/base)
  typechecks against open code only; the drivers that construct them are commercial.
- Never log provider metadata that could contain card or PII data (`console.log` is banned in
  product code).

## Scope

Signature verification + the port/config/event contracts only. Driver construction, event mapping, and
idempotency belong in `@caisson/billing-orchestration`; credit wallet operations in `@caisson/credits`.

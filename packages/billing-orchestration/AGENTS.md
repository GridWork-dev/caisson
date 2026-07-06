# @caisson/billing-orchestration — agent usage note

Commercial billing orchestration: the checkout drivers, the provider→`DomainBillingEvent` parsers, and
the dual-layer webhook idempotency. Signature verification is NOT here — it stays open in
`@caisson/billing` (`verifyStripeWebhook`, `verifyPaddleWebhook`, `verifyLemonSqueezyWebhook`,
`verifyPolarWebhook`), which this package composes.

## Key surface

- `createStripeBilling` / `createPaddleBilling` (the live MoR) / `createLemonSqueezyBilling` /
  `createPolarBilling` return a `BillingProvider` (the open port): `verifyAndParse` (open verifier +
  local parser) + `createCheckout` (REST checkout creation via `fetchWithTimeout`).
- `parseStripeEvent` / `parsePaddleEvent` / `parseLemonSqueezyEvent` / `parsePolarEvent` map a verified
  provider payload onto the ONE `DomainBillingEvent` union — no provider-specific type escapes.
- `processEvent` / `withIdempotentSideEffect` / `PROCESSED_EVENT_SCHEMA_SQL` are the outer +
  per-side-effect exactly-once claim layer, run inside the caller's `withTenant` tx.
- Webhook handlers MUST pass the raw request body (not parsed JSON) to `verifyAndParse`.
- Never log provider metadata that could contain card or PII data (`console.log` is banned in product
  code — a non-fatal anomaly threads through the driver's `onWarn` callback instead).

## Scope

Checkout-driver construction, event mapping, and webhook idempotency only. Signature verification lives
in `@caisson/billing`; credit wallet operations belong in `@caisson/credits`.

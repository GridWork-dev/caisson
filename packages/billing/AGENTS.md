# @caisson/billing — agent usage note

Provides the provider-agnostic `BillingProvider` port: raw-body HMAC webhook verification and typed
`DomainBillingEvent` dispatch for both Stripe (`createStripeBilling`) and Paddle
(`createPaddleBilling`, ADR-0108, the live MoR) — no SDK for either, both hand-rolled HMAC verifiers.

## Key surface

- Webhook handlers MUST pass the raw request body (not parsed JSON) to the HMAC verifier.
- The `BillingProvider` interface is the only surface editions touch; no Stripe or Paddle type escapes
  the package — every driver maps onto the same `DomainBillingEvent` union.
- `DomainBillingEvent` objects are enqueued through `@caisson/jobs` — never processed inline.
- Never log Stripe/Paddle metadata that could contain card or PII data (`console.log` is banned in
  product code).

## Scope

Stripe + Paddle integration and webhook verification only. Credit wallet operations belong in
`@caisson/credits`.

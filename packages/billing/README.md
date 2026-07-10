# @caisson/billing

The open (Apache-2.0) billing seam behind one provider-agnostic `BillingProvider` port — Stripe, Paddle
(the live MoR), LemonSqueezy, and Polar.

- **Layer:** base

Real src + tests: raw-body HMAC webhook signature verification for all four providers, the
`BillingProvider` port + config-type contracts, and the provider-agnostic `DomainBillingEvent` schema.
The checkout drivers, provider→domain event parsers, and webhook idempotency are the commercial carve in
`@caisson/billing-orchestration` (commercial).

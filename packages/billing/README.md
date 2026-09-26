# @caisson/billing

The billing seam behind one provider-agnostic `BillingProvider` port — Stripe, Paddle, LemonSqueezy,
and Polar.

- **Layer:** base
- **License:** Apache-2.0

Real src + tests: raw-body HMAC webhook signature verification for all four providers, the
`BillingProvider` port + config-type contracts, and the provider-agnostic `DomainBillingEvent` schema.
The checkout drivers, provider→domain event parsers, and webhook idempotency live in
`@caisson/billing-orchestration`.

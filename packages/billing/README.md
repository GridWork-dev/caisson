# @caisson/billing

Merchant-of-Record billing + webhooks behind one provider-agnostic `BillingProvider` port — Stripe,
Paddle (the live MoR), LemonSqueezy, and Polar.

- **Layer:** base

Real src + tests: Stripe, Paddle, LemonSqueezy, and Polar drivers, HMAC webhook verification, and
provider-agnostic domain billing events.

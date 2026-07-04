# @caisson/billing

Merchant-of-Record billing + webhooks behind one provider-agnostic `BillingProvider` port — Stripe
(original) and Paddle (the live MoR, ADR-0108).

- **Layer:** base

Real src + tests: Stripe + Paddle drivers, HMAC webhook verification, and provider-agnostic
domain billing events.

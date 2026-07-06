---
"@caisson/billing": minor
"@caisson/billing-orchestration": minor
---

The billing-orchestration carve: `@caisson/billing` narrows to the OPEN seam — raw-body HMAC webhook signature verification for all four providers (Stripe/Paddle/LemonSqueezy/Polar, the LemonSqueezy/Polar verifiers extracted into their own open verify-only files), the `BillingProvider` port + every provider's config TYPE, and the `DomainBillingEvent` schema — so apps/base's free-floor demo typechecks against open code only. The `@caisson/tenancy-rls` dependency drops (its only consumer, `idempotency.ts`, moved). New commercial `@caisson/billing-orchestration` ($99, priceCents 9900, tier `paid`, `LicenseRef-Caisson-Commercial`) holds the checkout-driver factories (`createStripeBilling`/`createPaddleBilling`/`createLemonSqueezyBilling`/`createPolarBilling`), the provider→`DomainBillingEvent` parsers (`parseStripeEvent`/`parsePaddleEvent`/`parseLemonSqueezyEvent`/`parsePolarEvent` + their envelope schemas), and the dual-layer webhook idempotency (`processEvent`/`withIdempotentSideEffect`/`PROCESSED_EVENT_SCHEMA_SQL`); deps kernel + tenancy-rls + billing (commercial→open).

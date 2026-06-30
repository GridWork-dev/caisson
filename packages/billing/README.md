# @caisson/billing

Merchant-of-Record billing + webhooks behind one provider-agnostic `BillingProvider` port — Stripe
(original) and Paddle (the live MoR, ADR-0108).

- **Layer:** base
- **Seeds (rebuild-clean):** gridwork
- **Key ADR:** ADR-0012, ADR-0108 (Paddle MoR switch)

> **Built** — real src + tests (Stripe + Paddle drivers + webhook events). Live per-package status: ../../docs/build-state.md
> Build per `/plan.md`. Pro-private `media-pipeline` contributes patterns only, never code.

# ADR-0116 — Billing driver scope: Paddle is the sole platform provider; Stripe stays a buyer driver

Status: accepted · 2026-06-30 (operator lock — closes the **Stripe-scope fork** opened when the
operator said "no Stripe, Paddle entirely". Extends **ADR-0108** (Paddle-MoR is the platform payment
provider); clarifies **ADR-0017** (the Stripe billing port) re: the buyer-facing package vs the
platform's own revenue path.) Append-only; supersede with a later ADR, never edit.

There are **two distinct billing layers**, and "Paddle entirely" binds only the first:

1. **Platform commerce** — how the operator sells Caisson editions/modules/subscriptions. This is
   **Paddle Merchant-of-Record only** (ADR-0108). `services/license`'s billing webhook and the
   `apps/site` `/dashboard` checkout wire the **Paddle** `BillingProvider` driver. **No Stripe on the
   platform's own revenue path.**
2. **`@caisson/billing` (the buyer-facing package)** — the billing toolkit a buyer composes into
   _their own_ product to bill _their own_ customers. It **keeps the working Stripe driver** (ADR-0017)
   **and** now ships a **Paddle driver** (built this session — `paddle-webhook.ts` / `paddle-events.ts`
   / `createPaddleBilling`, HMAC `ts:rawBody` verify, `transaction.completed` → `DomainBillingEvent`).
   Both sit behind the one `BillingProvider` port; the buyer picks either rail.

## Why

The platform's Merchant-of-Record choice (Paddle, ADR-0108 — Paddle remits VAT/sales tax so the
solo operator doesn't) is **orthogonal** to what payment rails the _buyer's_ product offers. The
Stripe driver is tested, shipped product value; **deleting it would strip buyer optionality for zero
platform benefit**. So Paddle wins the platform path absolutely, while `@caisson/billing` becomes
**multi-driver** behind the unchanged port — the cleanest expression of the ADR-0003 composable-port
design (a provider is a driver choice, not a fork).

## Scope — what changes, what does NOT

**Changes:** the platform's own commerce (`services/license` webhook handler + the `/dashboard`
purchase/upgrade flow) instantiates the **Paddle** driver; `@caisson/billing` gains a Paddle driver
alongside Stripe; `@caisson/pricebook` price-id fields are provider-neutral (`stripePriceId` →
`providerPriceId`, done this session — doc-comment rename, no signature break).

**Unchanged:** the `BillingProvider` port shape; the Stripe driver/webhook/events parser + their
tests stay in `@caisson/billing`; `services/license`'s provider-agnostic `apply-billing-event.ts`
(grants key off the `DomainBillingEvent` vocabulary, not the provider); the ADR-0089 cycle→grant path
(Paddle `transaction.completed` with a `subscription_id` routes to the existing `invoice.paid`
domain member — no grant-gate change).

## Relations

- **Extends ADR-0108** — Paddle-MoR is the platform provider; this ADR pins that the platform path is
  Paddle-_only_ and records what happens to Stripe (retained, buyer-scoped).
- **Clarifies ADR-0017** — Stripe is no longer the platform provider (ADR-0108 already moved that);
  it persists as a **buyer-selectable** `@caisson/billing` driver. The port + Stripe-Tax notes stand
  for buyers who pick Stripe-as-PSP.
- References **ADR-0089** (subscription cycle → credit grant; event source is Paddle per ADR-0108).

## Build-now vs DEPLOY-class

**Buildable now:** the Paddle `@caisson/billing` driver (done) + wiring the platform's
`services/license` webhook and the `/dashboard` checkout to Paddle (part of the unified-app build).
Stripe driver left in place, untouched.

**DEPLOY-class (operator-gated):** Paddle live vendor account + product/price catalog + webhook
signing secret + the `apps/site` Paddle.js client token; a live-sandbox check that the
`adjustment.updated` refund payload carries `custom_data` (the one flagged Paddle-driver gap). Stripe
needs no operator creds — it is dormant on the platform path. Runbook:
`docs/state/p6-deploy-runbook.md`.

## Binding

Platform commerce is Paddle-only (ADR-0108); `@caisson/billing` is a multi-driver package retaining
Stripe as a buyer-selectable rail and adding Paddle, both behind the one `BillingProvider` port.
Purging Stripe from the product, or putting Stripe back on the platform's revenue path, requires a
superseding ADR.

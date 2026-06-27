# ADR-0017 — Billing provider, tax, and webhook verification

Status: proposed · 2026-06-27 (foundations track; resolves the open billing/MoR fork)

The payment provider is **Stripe**, with **Stripe Tax** for tax calculation (operator lock).
**Honest framing:** Stripe is a PSP, **not** a merchant-of-record — _Caisson (the operator) is the
merchant of record_; Stripe Tax computes VAT/sales tax at checkout but the operator remits.
Chosen for best-in-class DX/docs, the cleanest webhook model, and Checkout/Tax/Billing covering
one-time editions + à-la-carte modules + subscriptions/credits (ADR-0012) in one provider. The
MoR tax-remittance burden is the accepted tradeoff vs Paddle/Lemon-Squeezy.

**Containment — `BillingProvider` port.** No Stripe type leaks past `@caisson/billing`. The package
exposes a provider-agnostic port (`createCheckout`, `verifyWebhook`, `parseEvent → DomainBillingEvent`)
with a Stripe driver behind it; a future MoR swap (Paddle/LS) is a new driver, not a rewrite. The
rest of the base consumes only `DomainBillingEvent` (a typed, Zod-`.strict()` union:
`purchase.completed` · `subscription.created|updated|canceled` · `invoice.paid` · `refund.issued`).

**Webhook verification.** Every Stripe webhook is verified by its **`Stripe-Signature` HMAC-SHA256
scheme** against the endpoint signing secret (`whsec_…`) inside `verifyWebhook` — using the raw
request body, with **timestamp-tolerance replay protection** and a **timing-safe** signature
compare (the Stripe SDK's `constructEvent`, or an equivalent `crypto.timingSafeEqual` path). An
unverified or stale-timestamp payload is rejected before any parse. The handler is idempotent on
the Stripe **event id** → the credit/entitlement effect debits/grants exactly once (ADR-0024).

**P1 ↔ P6 event split.** **P1 (this track)** builds the _mechanism_: the port + Stripe driver,
signature verification, raw-body handling, `parseEvent → DomainBillingEvent`, and the **typed
seam** that hands a verified event to the credit wallet's idempotent grant primitive (ADR-0007).
**P6 (commerce)** builds the _orchestration_ in `services/license`: purchase → entitlement rows →
Ed25519 license issuance → credit grant → registry access, and the subscription monthly-allotment
grant. P1 proves "a verified webhook can idempotently grant credits"; P6 wires the full commerce
flow on top.

Rejected: Paddle / Lemon Squeezy (true MoR — would remove the tax burden — but heavier approval
[Paddle] or post-acquisition roadmap risk + redundant license-keys [LS]; operator chose Stripe's
DX/control). Per-call Stripe metering with no local credit wallet (latency + no hard cap —
ADR-0007). Skipping signature verification / using parsed JSON (forgeable; HMAC over raw body is
mandatory).

Binding: every webhook verifies the Stripe HMAC over the raw body with replay protection before
parse; no Stripe type escapes `@caisson/billing`; the credit effect is idempotent on the event id;
P1 ships the verified-event→grant seam, P6 the commerce orchestration.

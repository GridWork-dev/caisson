---
updated: 2026-07-10
status: design-note
grounds:
  - apps/site/app/(marketing)/affiliates/page.tsx
  - packages/billing/src/events.ts
---

# Affiliate attribution — in-house mechanics on Paddle Billing

**The 2026-07-10 picker lock:** prove the mechanics in sandbox now; full program configuration
rides the production flip. This note is the design + the proof.

## The constraint that shapes everything

**Paddle Billing has no native affiliate/commission feature.** Paddle Classic's affiliate
program was retired and did not carry into Billing (verified against developer.paddle.com,
2026-07-10 — the ecosystem answer is a third-party layer like Rewardful/FirstPromoter/Refgrow,
or in-house). Two consequences:

1. **Attribution must be ours.** The clean primitive is a per-affiliate discount code:
   `POST /discounts` (API-creatable in sandbox and production), one code per affiliate, and the
   redeemed code arrives on every transaction webhook as `data.discount_id` — joinable back to
   the affiliate with zero client-side tracking, no cookies, no pixel.
2. **Payouts are never Paddle's.** Paddle (MoR) pays the seller only; commissions are paid by
   Caisson directly. The `/affiliates` page copy was corrected accordingly (2026-07-10 — it
   previously said commissions were "paid out through Paddle", which overclaimed; ADR-0080).

## Sandbox proof (2026-07-10)

- `POST https://sandbox-api.paddle.com/discounts` with a bare percentage body → **201**,
  `dsc_01kx5b0f9majy4wbgq5cjgdm7y`, code `CAISSONAFF1`, 10%, `enabled_for_checkout: true`.
  (Codes must match `^[a-zA-Z0-9]{1,32}$` — no hyphens.)
- The same mechanics were shipped live the same day for the abandoned-checkout email
  (`CAISSONCART10` + the cart's `?promo=` → `Paddle.Checkout.open({ discountCode })` plumbing),
  so the checkout-side redemption path is already proven code, not design.

## The gap to close at production flip (the whole remaining build)

- **`discount_id` is dropped today.** `parsePaddleEvent` (`packages/billing/src/events.ts`)
  does not map `data.discount_id` into the `DomainBillingEvent`, so nothing downstream
  (`order_record`, PostHog `purchase`) carries it. The capture is one field threaded through:
  events union → `apply-billing-event` → an `order_record` column (or the PostHog `purchase`
  properties) — small, but it gates any attribution report.
- Per-affiliate code minting (scripted `POST /discounts` per accepted affiliate, production key).
- A commission report (orders grouped by `discount_id`, 14-day refund-window filter, clawback on
  `refund.completed` — the page's stated terms) and the manual payout run.
- Decision left open on purpose: in-house report vs a third-party layer if affiliate volume ever
  justifies it. Nothing in this design forecloses either.

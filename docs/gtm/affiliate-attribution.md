---
updated: 2026-07-13
status: live
grounds:
  - apps/site/app/(marketing)/affiliates/page.tsx
  - packages/billing/src/events.ts
  - apps/admin/src/app/api/admin/affiliate/mint/route.ts
  - apps/admin/src/app/business/affiliates/page.tsx
  - services/license/src/affiliate-store.ts
  - knowledge/decisions/ADR-0320-affiliate-program-parameters.md
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

### End-to-end delivery proof (2026-07-10, later sitting)

- **Discount math:** `POST /pricing-preview` with `CAISSONAFF1`'s id on the billing-orchestration
  module (`pri_01kwwqa266p6smw4yaanxg1n5j`, $99.00) → subtotal `9900`, discount `990`, total
  `8910` — exactly 10%.
- **Webhook attribution:** a `transaction.completed` simulation (`ntfsim_01kx6822kdnaxzzxma3m8mf1q2`,
  txn `txn_01simaffproof0710aaaaaaaaa`) carrying `discount_id` was delivered to the live
  `https://license.caisson.sh/webhook` destination → **200 `{"ok":true}`**, `discount_id` intact in
  the delivered payload, `subscription_id` explicitly null (one-time routing). A discounted
  transaction fulfills cleanly today; the id is joinable the moment `parsePaddleEvent` captures it.
- Test grant landed on the 07-04 proof account (`dBlFuTeHu9TTwl7DXZTxpQa7Nq7B8VTQ`) — revoke via
  admin alongside the earlier one when convenient.

## Shipped (ADR-0320, 2026-07-10, Kickoff-N) — flat 10% buyer discount / 30% commission

The build described as remaining above is done:

- **`discount_id` now flows through.** `parsePaddleEvent` (`packages/billing/src/events.ts`)
  threads `data.discount_id` into the `DomainBillingEvent` on both `purchase.completed` and
  `invoice.paid` (see the line-42 comment + implementation) — the field reaches `order_record`
  and PostHog `purchase` properties.
- **Per-affiliate code minting is live** at
  `apps/admin/src/app/api/admin/affiliate/mint/route.ts`.
- **The admin dashboard is live** at `apps/admin/src/app/business/affiliates/page.tsx`.
- **Program parameters are locked and live**: `AFFILIATE_DISCOUNT_PCT` (10% buyer discount) and
  `AFFILIATE_COMMISSION_BPS` (30% commission) in `services/license/src/affiliate-store.ts`.

Decision left open on purpose: in-house report vs a third-party layer if affiliate volume ever
justifies replacing this. Nothing in this design forecloses either.

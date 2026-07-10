# ADR-0320 — Affiliate program parameters: fixed 10%/30%, full-scope discount_id capture, copy trued

**Status:** accepted · 2026-07-10 (Kickoff-N execution picker). **Tags:** `billing`.
Refines `SPEC-affiliate-production-flip` (ADR-0315) at the two points its lock left unbound.

## Context

The affiliate flip's mint lever needs two numbers the spec deferred to the D6 GTM item: the
buyer-facing discount on each code and the affiliate's commission rate. The live `/affiliates`
page promised "30%, rising to 50% for top-tier partners" — a tier structure that was never
locked as engineering scope. Separately, Paddle delivers `discount_id` on subscription
transactions too, and the spec text only named the one-time purchase path.

## Decision

1. **Fixed parameters: 10% buyer discount, 30% commission (3000 bps), every code.** No
   per-mint inputs on the lever; the constants live as named exports in the affiliate store
   (`AFFILIATE_DISCOUNT_PCT = 10`, `AFFILIATE_COMMISSION_BPS = 3000`) and are stamped onto
   each `affiliate_code` row at mint so a future parameter change never rewrites history.
2. **Public copy trued to the locked mechanism.** The `/affiliates` page drops the 50%
   top-tier framing entirely (flat 30%), names the 10% buyer discount as the referral
   mechanic, states attribution is code-based (no cookies/pixels), and quotes per-referral
   dollar figures on the honest basis — 30% of the discounted amount the buyer actually pays
   (27% of list), not 30%-of-list.
3. **`discount_id` is captured on BOTH one-time and subscription paths.** `parsePaddleEvent`
   threads `data.discount_id` (nullable) through the `purchase.completed` AND `invoice.paid`
   mappings onto `order_record` — an affiliate-referred subscription is still a referred sale.

## Consequences

- The D6 tier-structure Linear item collapses: there is no tier structure to design. Its
  remaining scope (public terms page polish) stays GTM.
- Commission math is integer-only off `order_record.amount` (post-discount minor units) ×
  3000 bps / 10000 — the report can never quote a figure the page didn't promise.
- Orders that predate the capture migration carry NULL `discount_id`; the commission report
  labels that window honestly rather than guessing (spec task 4 unchanged).
- Raising the rate for a specific partner later is a new ADR + a row-level value, not a code
  fork — the per-row `commission_bps` column already carries it.

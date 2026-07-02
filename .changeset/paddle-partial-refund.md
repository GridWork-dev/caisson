---
"@caisson/billing": minor
"@caisson/credits": minor
---

Paddle per-line partial refund — per-line entitlement revoke + per-line credit clawback (ADR-0218,
supersedes the ADR-0113 full-refund-only clause). Refunding ONE line of a multi-item Paddle cart is
no longer a full no-op.

`@caisson/billing`: the shared `DomainBillingEvent` gains provider-agnostic per-line refund shape
(fork D-2 shape / D-1 population). `purchase.completed.lineItems[]` carries each line's `itemId`
(Paddle `txnitm_…` join key from `details.line_items[].id`) + `chargedAmount` (the proportional-
refund divisor); `refund.completed` gains `adjustmentId` (the per-line clawback idempotency anchor)
and an `items[]` per-line array. The Paddle mapper populates them (correlates `items[]` with
`details.line_items[]` by order; parses a partial adjustment's `data.items[]`, skipping Paddle-
generated `tax`/`proration` items); Stripe/Polar/LemonSqueezy one-entry-wrap with empty sentinels
(no real per-line refund data).

`@caisson/credits`: `grant` accepts a per-line `lineItemId` + `lineChargedAmount`; `clawback`
accepts a per-line `lineItemId` + rounding provenance; new `lineCreditLedger` reads a line's
granted/clawed/charged totals so a per-line refund never over-claws past that line's grant onto
other lines' fungible balance. New `CREDIT_LINE_ITEM_MIGRATION_SQL` adds the nullable
`line_item_id` / `line_charged_amount` columns (fork C-b) and folds `COALESCE(line_item_id, '')`
into `credit_event_source_uniq` so a multi-item cart's N per-line `purchase` rows stay distinct
(integer money + round-down provenance per ADR-0007/0212).

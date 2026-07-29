# ADR-0394 — `refunded_amount` nets the upgrade-credit floor; `charged_amount` stays immutable

- **Date:** 2026-07-29
- **Status:** Accepted (operator lock at the forks picker, 2026-07-29)
- **Closes:** F2 of the `v2026.07.27.1` release audit (`outputs/audit/release-audit-v2026.07.27.1.md`)
- **Parent:** ADR-0381 lock 2 (the per-grant paid amount the upgrade-credit floor reads) ·
  ADR-0218 (per-line adjustment refunds, fork A-1) · ADR-0007 (integer minor units) ·
  ADR-0006 (append-only migrations)

## Context

F2 reproduced independently: `entitlement_grant.charged_amount` is written once at grant time and
**no refund or adjustment path ever updates it**. `upgradeQuote` credits an owned item at
`max(retail, paid)`, so after a partial refund the buyer's credit is floored at a price they no
longer paid in full. It needs three stacked events plus a later price cut to bite, and it
over-credits only the refunded slice.

The obvious fix was written, tested, and **removed**. An in-place decrement of `charged_amount` in
the dollar-partial branch is not idempotent, and this service has no event-level dedupe by design —
`app.ts:961`, "Paddle retry of the same event_id re-applies as a no-op" — so every handler carries
its own anchor. The sibling credit claw gets one from the `${adjustmentId}:${itemId}` unique key on
its ledger row. A bare UPDATE has no such anchor, and `item.amountRefunded` is **this adjustment's**
line total, not a cumulative one. Demonstrated against PGlite: one redelivery of the same adjustment
took a 164900 charge to 84900 instead of 124900 — trading a rare latent over-credit for a defect on
the routine retry path.

The clawback ledger cannot be reused as the anchor either. It records credits clawed, not dollars
refunded, and `apply-billing-event.ts` writes no row at all when `ledger.granted === 0` — precisely
the rows an upgrade quote reads.

## Decisions

### 1. `charged_amount` is immutable; refunds accumulate in a separate `refunded_amount`

A stamped charge that never mutates is what ADR-0381 lock 2 actually describes. The refunded total
for that grant's line lands in a new nullable `refunded_amount integer`, in minor units, with the
same non-negative CHECK the charged pair carries.

### 2. The idempotency anchor is an inline applied-adjustment set, not a second table

Option (a) as the audit stated it — "add a column and net at read time" — does not by itself solve
idempotency, because accumulating (`refunded_amount + $n`) redelivers exactly as badly as
decrementing. The durable per-`(line, adjustment)` state the audit called for ships as a second
column on the same row:

```sql
UPDATE entitlement_grant
   SET refunded_amount = COALESCE(refunded_amount, 0) + $3,
       refunded_adjustment_ids = array_append(COALESCE(refunded_adjustment_ids, '{}'), $4)
 WHERE account_id = $1 AND line_item_id = $2
   AND NOT (COALESCE(refunded_adjustment_ids, '{}') @> ARRAY[$4]);
```

One statement, so the guard and the write cannot interleave. A redelivery of the same adjustment
matches zero rows and is inert; two distinct sequential partial adjustments both apply. The
rejected alternative was option (b), a `(purchase_id, line_item_id, adjustment_id)` table: strictly
more general, but a second money table to keep correct, backfill, and audit, bought for a
cardinality that is at most a handful of adjustments per line.

### 3. Netting happens at read time, never at write time

`netCharged(charged, refunded)` returns `max(charged − refunded, 0)`, and `null` stays `null` —
"unknown" must not collapse to zero, or an unattributable charge would start crediting at retail-
minus-nothing instead of retail.

### 4. Only the dollar-partial branch records a refund

A fully-refunded line revokes its grant outright, so there is no surviving row whose floor could be
wrong. Recording a refund there would be dead state.

## Consequences

- **This lands with zero live behavior change.** `paidByItem` has **no production producer** today:
  nothing outside tests reads `charged_amount` from the database and builds the map, so the floor
  ADR-0381 lock 2 describes is not yet wired to live data. F2's over-credit is latent behind a read
  path that does not exist. This ADR pre-arms the correct figure so that whoever wires that read
  path cannot wire the wrong one — the netting helper is the only public way to turn the two columns
  into a paid amount.
- Migration `0033_entitlement_grant_refunded_amount.sql` is a tail append. Every slot at or below
  `0032` is checksum-pinned on the live database and stays untouched (ADR-0006).
- Applying the migration to production is a **separate operator-gated act**; this ADR authorizes the
  schema, not the apply.
- The audit's standing warning survives: **do not re-attempt the in-place decrement.** Option (c) —
  accept the over-credit and cap by policy — was rejected because the correct figure is cheap to
  record at the moment the refund arrives and expensive to reconstruct afterward.

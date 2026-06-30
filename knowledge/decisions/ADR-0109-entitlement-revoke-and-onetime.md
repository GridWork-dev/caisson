# ADR-0109 — Entitlement revocation + one-time purchases (reference-counted grants)

Status: accepted · 2026-06-30 (operator lock, P6 Bucket C item I2) · implements/extends ADR-0071
(entitlement store/resolver), ADR-0007 (append-only credit ledger / debit-before-spend), ADR-0089
(subscription cycle → grant + the commerce price-book), ADR-0017 (the P1↔P6 billing split), ADR-0005
(fail-closed RLS). Append-only — never edited; a later ADR supersedes.

## Context

ADR-0071 shipped a FLAT `account_entitlement` state table: one row per `(account, entitlement_id)`,
upserted `ON CONFLICT DO NOTHING`, with revoke-on-cancel explicitly deferred ("a follow-on slice once
subscription→entitlement provenance is modeled"). ADR-0089 wired the recurring grant
(`invoice.paid → grant credits + entitlements`) but left every other event a no-op: `subscription.canceled`
never revoked, `purchase.completed` never granted ("one-time entitlement needs line-item enrichment"),
and a refund did nothing. Three gaps remained:

1. **No revocation.** A canceled subscription kept its edition access forever.
2. **No one-time purchases.** A module/edition bought outright (not subscribed) granted nothing.
3. **No refund money policy.** A refunded purchase neither lost its entitlement nor returned credits.

The flat shape also could not model a single entitlement held from TWO sources (a subscription AND a
one-time buy) — a single revoke would wrongly strip access the other source still backs.

## Decision (the operator-locked forks)

**1. Reference-counted `entitlement_grant` junction (supersedes the flat `account_entitlement`).** One
ROW per `(account_id, entitlement_id, source)` grant. An account HAS an entitlement iff it holds **≥1
ACTIVE (non-revoked) grant** for it; `resolveAccountEntitlements` reads `SELECT DISTINCT entitlement_id …
WHERE status='active'`. The per-source idempotency anchor is the expression-unique index
`(account_id, entitlement_id, source_kind, COALESCE(subscription_id, purchase_id))`, so a renewal/retry
from the same source collapses to the existing row (refcount stays one-per-source). RLS posture is
unchanged from ADR-0005/0071: FORCE, fail-closed, a cross-tenant write refused by `WITH CHECK`. **Forward
migration:** pre-launch there is no live data (checkout not yet live, ADR-0082/0106), so the junction
**supersedes the flat table cleanly**; `ENTITLEMENT_GRANT_MIGRATION_SQL` is the belt-and-suspenders
backfill for any environment that created the old table (each legacy row → an ACTIVE `one_time` grant
keyed on its source event id — the safe default, since legacy rows carry no subscription provenance and
must not be swept by a subscription cancel). The ADR-0071 resolve/grant tests are updated to the junction
model, not broken.

**2. Source kinds `{subscription, one_time}`.** A `subscription` grant carries `subscription_id`
(`purchase_id` NULL); a `one_time` grant carries `purchase_id` — the Stripe **PaymentIntent id** —
(`subscription_id` NULL). A CHECK pins the shape. A module/edition bought one-time grants the **same
purchased ids** a subscription would (`@caisson/pricebook` gains a one-time `PURCHASE_BOOK` /
`resolvePurchase` alongside the recurring `PLAN_BOOK`); the registry index does the member-slug expansion
at the gate (ADR-0071, unchanged).

**3. Revoke on `subscription.deleted` is IMMEDIATE.** On cancel, soft-revoke every grant whose
`source_kind='subscription'` AND that subscription id (`status='revoked'`, stamp `revoked_at`). The
entitlement is lost only when its refcount hits 0 — a still-active one-time grant for the same
entitlement keeps it. `subscription.canceled` is enriched with the deleted subscription's id (the
`customer.subscription.deleted` object IS the subscription, so its `id`).

**4. Refund (`charge.refunded`) → soft-revoke the purchase's grant + claw back ONLY unspent credits.**
The operator-locked money policy: on a refund of a one-time purchase, (a) soft-revoke the grants tied to
that purchase (joined by the PaymentIntent id), AND (b) claw back the credits THAT purchase granted,
**bounded to the current balance** — `clawback = min(creditsGrantedByThisPurchase, currentBalance)` —
writing exactly ONE compensating negative `refund_clawback` ledger entry (integer units). The wallet
**never goes negative**: if the buyer already spent some/all of those credits, only the remainder is
reclaimed (down to 0 → no debit row, since `credit_event_amount<>0`). This requires the original credit
grant to be traceable to its source: a one-time purchase grants credits keyed on the PaymentIntent id, so
the refund (carrying the same PaymentIntent id on the Charge) looks the granted amount up. The refund
acts **only on a FULL refund** (`charge.refunded === true`); a partial refund is a no-op (it must not
strip all access or claw the whole grant). The whole refund is **idempotent within ONE transaction**,
RLS-scoped: the clawback runs whenever the purchase granted credits — NOT gated on the entitlement-revoke
count — so a credits-only purchase still reclaims its unspent credits; idempotency is the compensating
debit's own `(paymentId, refund_clawback)` unique key (distinct from the original grant's `(paymentId,
purchase)`), so a re-delivered refund writes no second debit. `clawback` locks the wallet row
(`SELECT … FOR UPDATE`) before computing `min(granted, balance)`, so a concurrent debit cannot diverge
the ledger from the wallet. Respects the append-only ledger (ADR-0007): the clawback is a NEW
compensating entry, never a mutation of the grant.

**5. Soft-revoke everywhere — never hard delete.** Revocation flips `status`/`revoked_at`; the row stays
for the audit trail. (Entitlements remain mutable current-truth, distinct from the immutable credit
ledger.)

## Wiring + seam

`apply-billing-event.ts` handles `subscription.canceled` (→ `revokeSubscriptionGrants`),
`purchase.completed` (→ one-time credit grant + `one_time` entitlement grant, fail-closed on a missing
payment id or unknown price), and the new `refund.completed` (→ a full-refund-gated revoke-and-clawback).
The mapper skips a subscription-mode `checkout.session.completed` (returns null) — it has no PaymentIntent
and its first grant arrives via `invoice.paid`; mapping it to a purchase would throw on the empty payment
id and storm Stripe with retries. `@caisson/billing` enriches `subscription.canceled` with
`subscriptionId`, `purchase.completed` with `priceId` + `paymentId`, and adds a `refund.completed` mapping
(carrying `fullyRefunded`) from `charge.refunded`. The W2/B1 seam trap is covered by a round-trip test:
`parseStripeEvent(charge.refunded) → applyBillingEvent` asserts the PaymentIntent join key resolves.
Account resolution on the refund relies on Stripe copying the PaymentIntent metadata (stamped at checkout
via `payment_intent_data[metadata][account_id]`) onto the Charge — `createCheckout` now stamps it for
payment-mode sessions, plus `metadata[price_id]` so the one-time purchase resolves without line-item
expansion (guarded by a checkout-param unit test). `@caisson/credits` gains `clawback` +
`creditsGrantedBySource` (and `refund_clawback` in the debit taxonomy); `clawback` is NOT `debit` (no 402
floor — it bounds to balance, locks the wallet row, instead of throwing).

## Consequences

- A canceled subscription immediately loses its edition access; a one-time buyer keeps theirs.
- The same entitlement survives losing one of its two backing sources (refcount).
- A refund returns only money the buyer hasn't spent — never overdraws, never double-claws on re-delivery.
- The flat `account_entitlement` is gone from new environments; prod migrates forward (or supersedes
  clean pre-launch).
- The credit ledger stays append-only and auditable; every revoke leaves a row.

## Deferred (not in I2)

- **Resubscribe reactivation.** A `one_time`/subscription grant revoked then re-granted from the same
  source is currently absorbed by `ON CONFLICT DO NOTHING` (stays revoked). Re-activation on re-grant is
  a follow-on (resubscribe-after-cancel).
- **Partial-refund / proration MODELING.** A partial `charge.refunded` is now a no-op (gated on
  `fullyRefunded`) — it never over-revokes or over-claws. Pro-rated partial reclaim (claw a fraction,
  revoke nothing) is the deferred modeling, not in I2.
- **Issuer / revoke-broadcast to the edge.** The offline-Ed25519 license (ADR-0047) is not re-issued on
  revoke; edge entitlement freshness is the issuer slice's concern.

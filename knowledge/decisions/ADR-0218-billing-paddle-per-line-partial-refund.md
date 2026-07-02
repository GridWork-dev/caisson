# ADR-0218 — billing: Paddle per-line partial refund — revoke + clawback

**Status:** accepted · 2026-07-02 (deferred-respec picker round, operator-locked).
**Relates:** SPEC `outputs/specs/deferred-respec/SPEC-paddle-partial-refund.md` (the locked draft) ·
**supersedes ADR-0113's "acts only on a FULL refund" clause and §1's `entitlement_grant` uniqueness
index shape** (extended, see below) · realizes ADR-0204's deferred per-line-refund fork · ADR-0007 /
ADR-0212 (integer money + rounding provenance — binding on the clawback arithmetic).

## Context

A partial refund of a multi-item one-time Paddle cart is today a full no-op
(`apply-billing-event.ts` short-circuits on anything but a full refund, per ADR-0113). Paddle
delivers per-item adjustments (`txnitm_` line references), so per-line revoke/clawback is
representable — but only if the purchase-time join key (line item → priceId/credits/entitlements)
is captured at grant time. That capture is only cheaply buildable pre-launch: it cannot be
backfilled for purchases made before it ships.

## Decision (four forks, operator-locked)

- **PF-1 = C-b (columns, not a side-table):** add nullable `line_item_id` to `entitlement_grant`
  and `credit_event`. This supersedes ADR-0113 §1's locked uniqueness index to the extent the
  index must incorporate the new column; no live grant data exists pre-launch, so the migration is
  clean.
- **PF-2 = A-1 (item-type semantics):** an item adjustment of `type: 'full'` revokes that line's
  entitlement and claws its credits; `type: 'partial'` (dollar-only) claws proportional credits and
  leaves the entitlement intact. Proportional arithmetic is integer-unit with rounding provenance
  (ADR-0007/0212).
- **PF-3 = B-1 (true per-line refcount):** an entitlement id backed by 2+ lines in one cart stays
  active until every backing line is refunded — consistent with the ADR-0071/0113 cross-source
  refcount ethos.
- **PF-4 = D-2 shape / D-1 population:** the refund-event shape is provider-agnostic (shared array
  form, symmetric with ADR-0204's `lineItems` precedent); only the Paddle driver populates it.

Idempotent across Paddle's per-item adjustment redeliveries.

## Rejected

- **C-a side-table (`purchase_line_grant`)** — the spec's recommendation; the operator chose the
  column form to keep the join key on the rows it governs rather than a second table to keep
  coherent.
- **A-2 (partial claws nothing until cumulative full)** — under-claws credits for dollar-partial
  refunds.
- **B-2 (cart-level OR revoke)** — over-revokes a multi-line-backed entitlement.

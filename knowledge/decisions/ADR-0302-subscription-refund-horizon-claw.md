# ADR-0302 — A subscription-payment refund claws back the coverage horizon (supersedes ADR-0269 Decision 6 accept)

**Status:** accepted · 2026-07-09 (Kickoff-H W3 commerce/license wave; the reversal locked in
the kickoff's fork rounds 1–2). **Supersedes** the ADR-0269 Decision 6 accepted residual "a
refund of a SUBSCRIPTION payment (as opposed to a one_time purchase) does not claw back the
period's grandfathered horizon" — that accept is the superseded lock; the rest of ADR-0269
stands. **Tags:** `billing`.

## Context

ADR-0269 grandfathered coverage horizons across `subscription.canceled` as "paid facts" — the
instant an actually-received payment covered through never shrinks on cancel. Its Decision 6
then accepted, as a ≤ one-paid-period residual, that a refund of a subscription payment leaves
that period's horizon live too. But a refund UN-pays the fact: leaving a refunded
subscription's horizon live is value leakage on the money seam with no bound in time — the
horizon feeds the signed `updatesWindows`/`entitledSince` claim fold, which perpetual offline
tokens carry forever. The refund sweep machinery (`reconcileCoverageGrants` + the
whole-transaction claw) already existed for one_time purchases; subscription payments were the
gap.

## Decision

- **`refund.completed` on a subscription payment rolls back the coverage horizon it granted.**
  The subscription ORDER row's paid→refunded flip (`order_record`, kind `subscription`) is
  both the detector (only a subscription invoice has such a row) and the idempotency latch (a
  redelivery flips nothing → rolls back nothing). The flipped row's price id resolves the
  plan's cadence; one cadence interval is the claw amount; the account's grant rows stamped by
  that subscription — static grants AND coverage mirrors, ANY status, since revoked rows'
  horizons still feed the grandfathered claim fold — shrink by that period
  (`rollbackSubscriptionCoverageHorizon`).
- **Scope is the horizon only.** Access-row revocation for a still-billing subscription stays
  the `subscription.canceled` event's job; the refund's existing credit claw (keyed on the
  same payment id) is unchanged.
- **Also shipped in the same wave — the static-grant ordering-race liveness fix** (CAISSON-25
  residual a, the "platform follow-up" ADR-0269 Decision 6 named): `subscription.canceled`
  now upserts a canceled TOMBSTONE status row even when the subscription never granted, and
  `invoice.paid` runs a grant-time liveness check under the canonical account billing lock —
  a late out-of-order granting invoice after a cancel grants no entitlements and no coverage
  mirrors (previously it minted active rows nothing would ever revoke). Cycle credits still
  grant: the payment was real, and a refund of it claws them.

## Consequences

- Closes both CAISSON-25 code residuals; ADR-0269 Decision 6's accept list shrinks to the
  live-Paddle dunning-configuration verification (an ops item, not code).
- A refunded subscription period can no longer leak updates/member coverage into perpetual
  offline tokens; the rolled-back bound converges to the buyer's own one_time-derived window
  at the next re-mint.
- The rollback keys on the whole-transaction full-refund shape; a per-line adjustment that
  fully refunds a subscription invoice's single line leaves the horizon (bounded at one paid
  period, favoring the buyer) rather than teaching the per-line branch subscription semantics.

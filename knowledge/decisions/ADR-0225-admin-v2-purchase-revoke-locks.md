# ADR-0225 — admin v2: operator revoke of real purchase entitlements (six fork locks)

**Status:** accepted · 2026-07-02 (third picker round of the day, operator-locked).
**Relates:** SPEC `outputs/specs/admin-v2-purchase-revoke/SPEC-admin-v2-purchase-revoke.md`
(the draft that proposed exactly this ADR number and defines forks R-1..R-6) · Linear
**CAISSON-19** · **extends ADR-0113** (refcount revoke / one-time / clawback — lifts its
"acts only on a refund webhook" limit for the non-refund case, leaves its deferred edge
revoke-broadcast to R-4) · **extends ADR-0220** (admin mutation surface v1 — reuses
`withAdminWrite`, the dual-log, the WORM anchor, `assertAccountExists`, CF-Access gating,
type-to-confirm; lifts `revokeAdminComp`'s comp-only ceiling) · **extends ADR-0218**
(per-line partial refund — its `creditsClawedForSource` / purchase-remainder bound is the
arithmetic the revoke clawback adopts to stay idempotent with any prior/later refund) ·
**extends ADR-0204** (owner gate / CF-Access-JWT auth floor, unchanged) · reuses ADR-0007 /
ADR-0212 (integer / branded money on the clawback), ADR-0005 / ADR-0052 / ADR-0006
(fail-closed RLS + WORM append-only), ADR-0014 (numbered `@caisson/migrate` migration),
ADR-0047 / ADR-0010 (edge Ed25519 license verify — the fact that a DB revoke does not reach
the edge, R-4).

## Context

Admin v1 (ADR-0220) deliberately revokes comp grants only — its `revokeAdminComp` filters
`source_kind = 'admin_comp'` and carries an explicit `ponytail:` ceiling comment
(`services/license/src/entitlement-store.ts:373`). So the only way a REAL paid
`entitlement_grant` (a `subscription`- or `one_time`-source grant) flips to `revoked` today
is the Paddle webhook path firing on `subscription.canceled` or `refund.completed`. When no
such provider event fires — a fraudulent buyer whose card the operator will not refund, a
chargeback already lost at the bank, a ToS ban — the paid grant stays `active` forever and
the only lever is raw SQL against the production money rows, the exact highest-risk action
ADR-0220 set out to remove.

A real-purchase revoke is genuinely its own fork round, not a one-line extension of v1: it
touches the money core (does it claw credits, bounded how?), the refcount model (an
entitlement backed by two paid sources), the external Paddle boundary (does revoke imply
refund?), and the edge (a revoked buyer still holds a signed offline license token that
grants registry access until it expires). The SPEC surfaced six operator forks (R-1..R-6);
all six are locked here. Everything mechanical (source-scoped revoke helpers, the bounded
CAISSON-5 clawback, the dual-log, the CF-Access gate, type-to-confirm) is already built and
tested — v2 is a thin composition plus one additive migration, EXCEPT the R-4 edge slice
(below), which the operator elected to build in.

## Decision (six forks, operator-locked)

- **R-1 = A (Recommended). DB-only: revoke the entitlement + claw UNSPENT credits, NEVER
  call Paddle.** Refunds stay operator-driven in the Paddle dashboard; the `refund.completed`
  webhook auto-syncs the DB and is idempotent with this claw (whichever lands second claws
  0). The credit-claw is an explicit **per-action operator checkbox, defaulting ON** (the
  fraud case). This keeps the doctrine trust boundary intact — no Paddle-write credential in
  the admin blast radius — and the `external-system` tag stays classification-only.
- **R-2 = A (Recommended). Source-scoped targeting.** The operator targets a specific paid
  SOURCE — a `subscription_id` or a `purchase_id`/`paymentId` — and v2 revokes every grant
  that source backs, reusing `revokeSubscriptionGrants` / `revokePurchaseGrants` unchanged.
  Refcount is preserved for free (a sibling source keeps the entitlement); this matches the
  webhook's own per-source unit of action.
- **R-3 = A (Recommended). One-time purchases ONLY in v2.** `source_kind = 'one_time'` grants
  are terminal, so a revoke sticks. A still-billing subscription's grant would be silently
  re-granted by the next `invoice.paid`; the correct lever for a subscription is to **cancel
  it in Paddle** → the `subscription.canceled` webhook revokes it durably. Subscriptions are
  out of v2's DB-revoke scope.
- **R-4 = B (OPERATOR OVERRIDE of the spec's Recommended A). Build the edge revocation
  list.** A CRL-style deny-set (revoked license / account ids) the registry Worker checks on
  a short cache, with a publish path from the revoke action. The SPEC scoped this as its own
  infra slice and recommended deferring it (accept a bounded staleness window). The operator
  locks the opposite: **v2's build INCLUDES the edge-revocation slice**, scoped as its own
  task / spec-section (not skipped, not silently folded into the thin composition). A DB-only
  revoke is invisible to the Worker, which verifies a signed offline token against a baked
  pubkey and never re-reads the DB; the deny-set is what actually cuts edge registry/download
  access for a revoked fraudster within the cache window rather than leaving it live until
  token expiry (forever, for `expiry: null` tokens).
- **R-5 = A (Recommended). A distinct new audit action type.** `purchase_revoke` is added to
  the `ADMIN_ACTIONS` enum and the `admin_action_log` CHECK via a numbered `@caisson/migrate`
  migration (ADR-0014); the credit clawback is captured in the **same action's `before/after`
  money snapshot**, not a separate row. "Revoked a comp" and "revoked a paid purchase +
  clawed $N" stay distinct events — the WORM chain is chargeback-dispute evidence, so the
  distinction is load-bearing.
- **R-6 = A (Recommended). Type-to-confirm PLUS a mandatory impact preview.** Before arming,
  the form shows the selected source, the exact entitlements that will drop (refcount-aware —
  "compliance stays active, backed by subscription sub_123"), and the credit-claw preview
  (`granted − alreadyClawed`, bounded to the wallet balance). The operator confirms against a
  concrete effect, not a blind id.

## Rejected

- **R-1 B (revoke, never claw)** — a fraudulent buyer keeps spendable credits they did not
  pay to keep; under-punishes the exact case v2 exists for. **R-1 C (revoke + claw + call the
  Paddle refund API)** — fires the blocking `external-system` audit, needs a Paddle-write
  credential in the admin blast radius, and collapses the refund-vs-strip distinction that
  motivates v2.
- **R-2 B (entitlement-scoped across all sources)** — over-revokes when two purchases back
  one entitlement; clawback becomes ambiguous. **R-2 C (single grant-row-scoped)** — worst
  ergonomics; the operator would read raw grant ids.
- **R-3 B (both, with a subscription "admin-suspended" flag)** — a real new surface (a
  suspension flag + a webhook-path check), only worth it to freeze access mid-cycle without
  cancelling billing; not v2.
- **R-4 A (accept a bounded staleness window, document it)** — the spec recommendation; would
  leave a revoked fraudster able to `npm install` premium modules until their token expires,
  materially bad for long-lived / perpetual tokens. The operator chose to fund the edge slice
  now. **R-4 C (force a license re-issue with reduced claims)** — does not revoke an
  already-distributed token; more moving parts for less coverage.
- **R-5 B (reuse `entitlement_revoke`, disambiguate by payload)** — conflates comp-revoke and
  paid-revoke in every audit query; a reviewer can't filter "every paid revoke" without
  parsing JSON. Rejected for a money / evidence seam.
- **R-6 B (reuse v1 type-to-confirm unchanged)** — the operator can't see refcount survival
  or the claw amount before committing, the exact places a paid revoke surprises you.

## Consequences

- **R-4 enlarges the build.** With A the marginal v2 code was < 250 LOC of thin composition.
  The R-4=B override adds a genuine infra slice — a Worker deny-set (a KV / asset the Worker
  reads on a short cache) and a publish path from the revoke action — with its own SPEC
  section, its own tests, and an `infra` surface. The upside the operator bought: a paid
  revoke actually cuts edge access within the cache window instead of leaving a documented
  "forever" window for `expiry: null` tokens. The deny-set narrows, but does not eliminate,
  the coupling to the token-TTL question (a short paid-token TTL still bounds worst-case
  staleness; the deny-set makes it a cache-window, not a token-lifetime, problem).
- **Idempotency with the refund path is preserved (R-1=A).** An operator revoke and a later
  Paddle refund of the same purchase are mutually idempotent — whichever lands second revokes
  nothing new and claws 0, because both use the CAISSON-5 `granted − alreadyClawed` remainder
  bound (ADR-0218) and the balance-bounded `clawback`.
- **The clawback stays integer / branded and never negative** (ADR-0007 / 0212), bounded to
  `granted − alreadyClawed` AND to the wallet balance — a Fable-lane, SECURITY-blocking
  review item, never fan-out.
- **One additive migration** (R-5) extends the audit-action enum + CHECK — small, pre-launch
  clean, no live paid-grant data to backfill.
- **The founding operator rule is satisfied:** no v2 product code ships until this ADR locks
  the six forks. The build is now unblocked (SPEC → PLAN → EXECUTE), with the R-4 edge slice
  split out as its own task.

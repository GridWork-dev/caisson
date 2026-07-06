# ADR-0252 — Credit expiry implementation: `grant_consumption` join table, FIFO order `created_at, expires_at, id`, badge + T-30d email

**Status:** accepted · 2026-07-06 (Kickoff-E picker round 1, independent-build-wave session).
**Extends ADR-0245** (pooled rollover + 12-month grant expiry + FIFO — this ADR locks the ledger
implementation), **ADR-0007** (integer wallet + append-only ledger), **ADR-0024** (idempotency),
**ADR-0218** (multi-item cart per-line grants). Append-only; supersede with a later ADR, never
edit. **Tags:** none at lock (mechanics); the build inherits `billing`.

## Decision

1. **`expires_at` lands as a nullable timestamptz on `credit_event`** (grant rows only), via a
   new numbered append-only migration in the `0002_credits.sql` layering tradition — the frozen
   schema string is never edited. Grants set it application-side (`created_at + 12 months`
   default, overridable per class per ADR-0245's carve-out).
2. **FIFO burn is materialized in a new append-only `grant_consumption` table**
   (`grant_event_id, debit_event_id, amount, created_at`): the debit path walks unexpired grants
   oldest-first and records which grant(s) each debit consumed, splitting across grants when one
   remainder can't cover the debit. Per-grant remaining balance is an indexed `SUM`, never a
   mutated column. Rejected: a mutable `remaining` column on the grant row (mutates a ledger row
   post-insert — violates the ADR-0007 append-only invariant); derived-from-ledger running-sum
   recomputation (re-derives the full per-account waterfall on every sweep — the expensive path
   at real subscriber volume).
3. **Burn order: `created_at ASC, expires_at ASC, id ASC`.** FIFO oldest-first stays primary;
   when grants tie on issue time (the real shipped case: ADR-0218 multi-item cart lines land with
   byte-identical transaction `created_at`), the sooner-expiring grant burns first, and the UUID
   `id` (the existing `getLedger` precedent) is the final deterministic tie-break. Rejected: a
   new monotonic sequence column — same-cart-line grants are fungible by construction.
4. **Existing prod grant rows are backfilled `created_at + 12 months`** in the same migration —
   they are Paddle-SANDBOX pipeline proofs, not customer money; a permanently two-tier
   (`NULL = never expires`) ledger is not worth protecting test data.
5. **Expiry is enforced by an idempotent sweep**: expired grants' residual balances are consumed
   by an expiry ledger event (wallet decremented atomically, `grant_consumption` rows written),
   never by silently excluding them from reads.
6. **Notification posture (operator pick, above the tabled rec): dashboard badge AND T-30d
   email, both now.** The dashboard credits page gains an expiring-soon read + element; the email
   track adds the product's first transactional/billing template in `packages/email`, a scheduled
   `@caisson/jobs` sweep, and a per-grant already-notified marker (append-only) so the notice
   fires once.

## Consequences

- The debit path gains a loop (read remaining-per-grant, write 1..k consumption rows) — covered
  by tests including the split-across-grants and all-expired (402) cases. Credit idempotency
  (ADR-0024) and the codegen debit points (ADR-0049/0093) are unchanged in semantics.
- `docs/gtm/pricing-packaging.md`'s stated commitment ("credits roll over; each grant lives 12
  months") now has a live mechanical floor.

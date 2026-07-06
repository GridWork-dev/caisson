# ADR-0245 — Credit policy: pooled rollover, 12-month grant expiry, top-ups

**Status:** accepted · 2026-07-05 (Kickoff-A picker round, SOT-expansion session). Closes research
gap #2 (`outputs/research/monorepo-bigpicture-2026-07.md` §2 row 2): the integer wallet + ledger +
subscription allotment existed (ADR-0007/0024/0089/0098) with no rollover/expiry/top-up policy.
**Extends ADR-0007** (integer credits), **ADR-0089** (cycle → credit grant), **ADR-0222** ($49
credit pack). Append-only; supersede with a later ADR, never edit. **Tags:** none at lock
(policy); the wallet-expiry implementation inherits `billing`.

## Decision

1. **Pooled rollover**: unused subscription-cycle credit grants roll over into the single pooled
   wallet — no use-it-or-lose-it reset. Evidence: pooled rollover + top-ups is the
   highest-scoring 2026 AI-pricing pattern (Clay, ElevenLabs); hard monthly reset scored as the
   less-coherent majority and reads punitive on a dev-tool pricing page.
2. **Every grant expires 12 months after issue** — subscription-cycle grants, top-up packs
   (ADR-0222 $49), and promotional grants alike, unless a later ADR states otherwise per class.
3. **Consumption is FIFO oldest-grant-first**, so balances near expiry burn first and a steady
   subscriber never actually loses credits.
4. Rejected alternatives: hard monthly reset (above); capped rollover at N× monthly (extra ledger
   - copy complexity without evidence it's needed at launch scale — revisit only if hoarding
     shows up in the ledger data).

## Consequences

- **Ledger implementation**: grant-level expiry timestamps + FIFO burn order land at the
  checkout-flip/billing build (the wallet is integer + ledgered already; expiry is additive).
  Named here, not built now.
- The pricing page and `docs/gtm/pricing-packaging.md` may state the commitment now: "credits
  roll over; each grant lives 12 months; top-ups anytime."
- Credit idempotency (ADR-0024) and the codegen debit points (ADR-0049/0093) are unaffected —
  expiry changes which grant a debit draws from, never whether it draws.

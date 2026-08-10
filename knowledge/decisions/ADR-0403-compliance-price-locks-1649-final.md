# ADR-0403 — Compliance list price locks at $1,649: the adjustment window closes

- **Date:** 2026-08-09
- **Status:** Accepted (operator lock at the D1–D15 board fork-walk, D4 — corrected re-ask)
- **Parent:** ADR-0012 (price anchors) · ADR-0373 (committed displayed point-values, explicitly
  not WTP-validated) · ADR-0386 (the 2026-07-25 reprice $1,449 → $1,649 as `oscal-spine` joined
  the Compliance bundle) · ADR-0082 (the site states committed prices)

## Context

The 2026-07 board audit's D4 recommended a fail-closed no-lock posture: no price movement in any
direction until a clean n≥5 real-ICP reaction round at the live anchor. That round never ran —
outreach is held behind the launch gate (ADR-0406), so the gate would have blocked price finality
indefinitely.

Numbering hygiene worth recording: the walk's first D4 answer was taken against the audit's
**stale** $1,449 figure. The operative displayed price has been **$1,649 since 2026-07-25**
(ADR-0386; `packages/pricebook/src/upgrades.ts` — "Repriced 1449 → 1649 as oscal-spine joined").
The question was re-asked with the operative number before anything was written; the near-miss
would otherwise have read as a $200 price cut.

## Decision

**$1,649 is the final Compliance list price.** The no-lock gate (board D4 option d) is retired;
the standing "operator may still adjust a number before checkout goes live" window
(CLAUDE.md § Still open) closes. No number moves on the site, in the pricebook, in Paddle, or in
the upgrade-credit floors as a result of this ADR — it locks the displayed state as final.

Future reaction data (the launch-time instruments of ADR-0406) may still inform pricing, but a
change is a **superseding ADR**, not an adjustment under a standing window.

## Consequences

- CLAUDE.md's "Still open (do NOT pre-bind)" pricing item retires — this was its last entry.
- ADR-0373's "explicitly NOT WTP-validated" caveat stands as history: the lock is a commitment
  decision, not a validation claim. Copy must not imply market validation (board D12 item 3
  enforces the footnote wording).
- Grandfathering policy is moot pre-first-sale and would ride any future superseding ADR.
- The discounted design-partner terms (ADR-0297) compute from this list price; what a
  discounted close validates is ADR-0404's labeling rule.

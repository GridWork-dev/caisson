# ADR-0297 — Design-partner first-N terms: 5 partners at 40% off, 12-month reverting

**Status:** accepted · 2026-07-08 (operator-locked, twelfth-sitting picker). Executes ADR-0273
(which locked the program shape and left the numbers open). **Tags:** `pricing`, `gtm`.

## Context

ADR-0273 locked the design-partner program — a first-N reference deal with a quiet application
surface shipping in the ADR-0272 site wave — and deferred the numbers (cohort size, discount
level, case-study obligation) pending comparables. The comparables memo landed
(`outputs/research/prelaunch-fanout-2026-07/followups/support-sku-design-partner-comparables-2026-07-07.md`):
discounts cluster 30–50% off, cohorts 3–6; candidate A (the SaaStr-standard structure: a 12–24
month reverting discount with case-study rights contingent on conversion) matches the ADR's
cohort framing.

## Decision

Candidate A, at the mid-point of both comparable clusters:

- **Cohort:** first **5** design partners.
- **Discount:** **40% off**, applied to the partner's initial purchase.
- **Duration:** the discount is **12-month reverting** — any renewal/subscription surface priced
  under the program reverts to list after 12 months.
- **Case-study obligation:** case-study/reference rights are **contingent on conversion** — a
  partner who churns owes nothing; a partner who converts to list-price terms grants the
  reference.

## Consequences

- The quiet application surface (ADR-0272 site wave) can ship with concrete terms behind it; the
  program no longer waits on the production-catalog flip.
- The D2/D3 bundle price levels stay independently HELD for the Cookiy quant data — the partner
  discount composes on whatever those land at.
- Grandfathering stays operator-owned (unchanged from ADR-0106).

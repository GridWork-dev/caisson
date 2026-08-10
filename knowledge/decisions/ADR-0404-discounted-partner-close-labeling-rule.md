# ADR-0404 — A discounted design-partner close validates the discount, never the list price

- **Date:** 2026-08-09
- **Status:** Accepted (operator lock at the D1–D15 board fork-walk, D5 — re-confirmed at an
  explicit conflict re-ask against the prior lock)
- **Parent:** ADR-0297 (design-partner terms — the terms themselves stand unchanged) ·
  ADR-0403 (the $1,649 list price the labels are measured against)
- **Supersedes:** ADR-0391 §D5 (the 2026-07-26 merged list/discount label, under which one
  40%-off close counted as list-price validation)

## Context

Board D5: when the first discounted design-partner deal closes, the temptation is to report it
as validation of the $1,649 list price. Both critiques converged that this is a measurement
error — a close at discounted terms is evidence about the discounted offer plus the
relationship, full stop.

The 2026-07-26 re-walk (ADR-0391) had locked the opposite: a merged label under which one
40%-off close both cleared the D6 tripwire and counted as list-price validation. The
2026-08-09 walk surfaced the conflict explicitly and the operator re-picked today's rule,
superseding the merged label.

## Decision

Any close at ADR-0297's discounted design-partner terms is recorded and reported as a
**"relationship + proof/case-study purchase," labeled as such** — in the demand ledger, in
instrument results, in investor/status narratives, everywhere. Only a full list-price
self-serve purchase counts as list-price validation.

## Consequences

- ADR-0297's terms are unchanged; what they **measure** is what this ADR pins.
- **ADR-0391's three-instrument design otherwise STANDS** (kept at the same conflict re-ask):
  buyer-map first, one commercial leg, public distribution with its own denominator. This ADR
  relabels the commercial leg only — it now measures **discounted-partner conversion**, and the
  full-price elasticity blind spot ADR-0391 acknowledged becomes explicit: a list-price
  validation claim requires a future full-price close or a new instrument.
- The D6 tripwire bar moves accordingly: "one paid partner" still clears it (a paid partner is
  a paid partner), but what that clearance VALIDATES is reported under this ADR's labels.
- A future case study built on a discounted close discloses the basis (the proof/case-study
  purchase framing), per the copy laws (ADR-0080).

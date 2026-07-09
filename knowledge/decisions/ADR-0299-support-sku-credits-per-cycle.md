# ADR-0299 — Priority-support SKU creditsPerCycle = 1000 (Developer parity)

**Status:** accepted · 2026-07-09 (Kickoff-H W3 commerce/license wave; the number locked in the
kickoff's fork rounds 1–2). Resolves the ADR-0288 rider (b) owed number; executes ADR-0288 and
references ADR-0278 (the priority-support SKU's Track-K frame). **Tags:** `billing`.

## Context

ADR-0288 locked the priority-support subscription's price and SLA ($999/yr,
next-business-day first response) but left rider (b) open: the plan row's `creditsPerCycle`
was a nominal 100-credit placeholder, noted as an operator-owed number. The plan-book schema
forbids a zero grant (`creditsPerCycle` must be a positive integer), so the row cannot simply
carry 0.

## Decision

**The priority-support plan grants 1000 credits per cycle** —
`price_priority_support_annual_PLACEHOLDER` in `packages/pricebook/src/plans.ts` carries
`creditsPerCycle: asCredits(1000)`, pinned by the plan test and the conversion golden;
`PRICEBOOK_VERSION` bumps to `2026-07-09.1` (append-only stamp convention, ADR-0006).

## Rationale

- The schema forbids 0, so some number must ship.
- The SKU's real value is the support role + response-time lane, not a credit allotment — but
  the number sits next to the $499 Developer plan's 1000-credit grant on a pricing page, and
  100-next-to-1000 read stingy for a $999 SKU. Developer parity reads clean and needs no new
  justification anywhere copy mentions credits.

## Consequences

- Closes CAISSON-42 and the ADR-0288 rider (b).
- The row stays a PLACEHOLDER (no Paddle product exists yet); the operator swaps the key for
  the real `pri_…` id at graduation, same as every other row in the book. The credit number
  itself is now locked, not a placeholder.

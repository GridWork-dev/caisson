# ADR-0206 — Branded money types + rounding provenance (Wardfile B3)

**Status:** accepted · 2026-07-02 (harvest slice-2 wave, ADR-0204 scope lock). Builds as the SERIALIZED
wave-2 of the session (cross-package API thread), after the disjoint-dir wave-1 packages land.
**Relates:** ADR-0007 (integer money), ADR-0089/0060 (rounding direction: grants round DOWN, costs round
UP), ADR-0098 (credit denomination in kernel), ADR-0133 (Wardfile B3 lift).

## Context

Money discipline is strong on _policy_ (integer-only, documented+tested rounding direction) but has zero
compile-time _unit safety_: every cents/credits/micro-USD quantity is a bare `number` (no `.brand()`
usage repo-wide), so a cents value passes silently where credits are expected. And every rounding site
(`centsToCredits`, ai-meter's `ceilDiv`) discards the pre-rounding value and direction once it returns —
the credit ledger persists only the final integer, making rounding unauditable after the fact.

## Decision

1. **Branded money types in `@caisson/kernel`:** nominal `Cents` / `Credits` / `MicroUsdPerCredit` types
   with constructor/unwrap helpers, threaded through kernel `credit-conversion.ts`, pricebook
   plans/purchases/actions, and ai-meter's cost legs. DB-boundary unwrap stays explicit. The exact brand
   mechanism (Zod `.brand<>()` vs TS-native brand) is a SPEC-level engineering choice.
2. **Rounding provenance:** every rounding site returns a `RoundedMoney`-style record ({raw, mode,
   result}) and the credit-ledger write path (`services/license/apply-billing-event.ts`) persists the
   provenance alongside the final integer amount (schema extension via the `@caisson/migrate` convention).
   ADR-0007's integer-only invariant is untouched — provenance describes the rounding, the stored amount
   stays an integer.

## Rejected

- **Type-only change without ledger persistence** — provenance that dies at function return can't answer
  "why did this grant round to N" during an audit; the Wardfile ask is auditability, not just types.
- **Defer the L-sized provenance half** — recommended as the lazy default; operator locked full scope
  (ADR-0204 §2).

---
"@caisson/kernel": minor
"@caisson/credits": minor
"@caisson/pricebook": minor
"@caisson/ai-meter": minor
"@caisson/ai-kit": patch
"@caisson/cli": patch
---

Branded money types + rounding provenance (ADR-0206, harvest slice-2 serialized wave-2).
Kernel gains `src/money.ts`: TS-native nominal `Cents`/`Credits`/`MicroUsd`/`MicroUsdPerCredit`
brands (compile-time only, zero runtime cost), `asCents`/`asCredits`/`asMicroUsd`/
`asMicroUsdPerCredit` constructors (throw `ValidationError` on a non-integer/negative input),
the identity `unwrapMoney` DB-boundary marker, and the `RoundedMoney<TRaw,TResult>`
`{raw, mode, result}` record; `centsToCredits` now returns `Credits` and
`centsToCreditsProvenance` returns the round-DOWN provenance record. Credits: `GrantInput`/
`DebitInput.amount` are `Credits`, both accept optional `rounding`, and the new
`CREDIT_ROUNDING_MIGRATION_SQL` (appended as platform migration `0007_credit_rounding.sql` —
never an edit to the checksum-pinned `CREDIT_SCHEMA_SQL`) adds nullable
`rounding_raw`/`rounding_mode` to `credit_event` with a biconditional + mode-enum CHECK.
Pricebook: `creditsPerCycle`/`credits`/`codegenRunCredits` are branded; re-exports
`centsToCreditsProvenance`. ai-meter: `CostBreakdown` is branded and gains `roundingCredits`
(`mode: "up"`, ADR-0060) which `reserve()`/`reconcile()` persist onto their ledger rows;
`BUNDLED_PRICE_BOOK` gains the `openai/text-embedding-3-small` row (ADR-0207 —
embedding pricing is config, not code; `PRICE_BOOK_VERSION` bumped to 2026-07-02).
`apply-billing-event` grants stay exact table integers with NULL/NULL provenance
(ADR-0089 §5); ADR-0007 integer-at-rest is untouched. ai-kit/cli: boundary mints +
test fixture updates only.

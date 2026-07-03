# @caisson/credits

## 0.3.0

### Minor Changes

- ccf8b10: Branded money types + rounding provenance (ADR-0212, harvest slice-2 serialized wave-2).
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
  `BUNDLED_PRICE_BOOK` gains the `openai/text-embedding-3-small` row (ADR-0213 —
  embedding pricing is config, not code; `PRICE_BOOK_VERSION` bumped to 2026-07-02).
  `apply-billing-event` grants stay exact table integers with NULL/NULL provenance
  (ADR-0089 §5); ADR-0007 integer-at-rest is untouched. ai-kit/cli: boundary mints +
  test fixture updates only.
- aaff518: Paddle per-line partial refund — per-line entitlement revoke + per-line credit clawback (ADR-0218,
  supersedes the ADR-0113 full-refund-only clause). Refunding ONE line of a multi-item Paddle cart is
  no longer a full no-op.

  `@caisson/billing`: the shared `DomainBillingEvent` gains provider-agnostic per-line refund shape
  (fork D-2 shape / D-1 population). `purchase.completed.lineItems[]` carries each line's `itemId`
  (Paddle `txnitm_…` join key from `details.line_items[].id`) + `chargedAmount` (the proportional-
  refund divisor); `refund.completed` gains `adjustmentId` (the per-line clawback idempotency anchor)
  and an `items[]` per-line array. The Paddle mapper populates them (correlates `items[]` with
  `details.line_items[]` by order; parses a partial adjustment's `data.items[]`, skipping Paddle-
  generated `tax`/`proration` items); Stripe/Polar/LemonSqueezy one-entry-wrap with empty sentinels
  (no real per-line refund data).

  `@caisson/credits`: `grant` accepts a per-line `lineItemId` + `lineChargedAmount`; `clawback`
  accepts a per-line `lineItemId` + rounding provenance; new `lineCreditLedger` reads a line's
  granted/clawed/charged totals so a per-line refund never over-claws past that line's grant onto
  other lines' fungible balance. New `CREDIT_LINE_ITEM_MIGRATION_SQL` adds the nullable
  `line_item_id` / `line_charged_amount` columns (fork C-b) and folds `COALESCE(line_item_id, '')`
  into `credit_event_source_uniq` so a multi-item cart's N per-line `purchase` rows stay distinct
  (integer money + round-down provenance per ADR-0007/0212).

### Patch Changes

- 95103b6: Money-path hardening (post-wave triage CAISSON-5/6/7/8/9). `parsePaddleEvent` now correlates
  `items[]` to `details.line_items[]` by their shared `price_id` instead of array position, and fails
  closed on a duplicate non-empty per-line join id; a malformed adjustment item now signals through an
  optional `onWarn` callback, threaded all the way from `PaddleConfig` through `verifyAndParse` and
  wired to `services/license`'s stderr telemetry, instead of a silent skip. `@caisson/credits` gains
  `creditsClawedForSource`, which `services/license`'s `applyBillingEvent` uses to bound BOTH a
  whole-transaction `type:full` refund claw AND a per-line partial claw to the purchase's
  granted-minus-already-clawed remainder regardless of delivery order, never spilling onto another
  purchase's credits. `@caisson/tenancy-rls` gains `buildAdminSelectPolicySql`, a SELECT-only
  cross-tenant policy variant; `services/license`'s admin mutation surface now uses it (rather than the
  write variant) for its read-only `account_member` existence check, and (`grantEntitlementAdmin` /
  `adjustCreditsAdmin`) fails closed with a 404 on a nonexistent target account, rolling back the whole
  transaction before any entitlement or credit row commits.
- Updated dependencies [b5915e0]
- Updated dependencies [b5915e0]
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [afa6070]
- Updated dependencies [95103b6]
- Updated dependencies [549dd4e]
  - @caisson/registry-schema@0.2.1
  - @caisson/tenancy-rls@0.3.0
  - @caisson/kernel@0.3.0

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- Updated dependencies [72ffd85]
- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/registry-schema@0.2.0
  - @caisson/kernel@0.2.0
  - @caisson/tenancy-rls@0.2.0

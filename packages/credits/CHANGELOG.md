# @caisson/credits

## 0.6.3

### Patch Changes

- Updated dependencies [498b279]
- Updated dependencies [cd694f1]
- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/tenancy-rls@0.6.1
  - @caisson/registry-schema@0.5.12
  - @caisson/kernel@0.10.0
  - @caisson/jobs@0.7.4

## 0.6.2

### Patch Changes

- 87275f6: Replace ESLint and Prettier with oxlint and oxfmt.

  Linting and formatting now run on the oxc toolchain. The rule floor is unchanged: the same
  no-any, no-console, type-only-import and provider-SDK-boundary rules are enforced, at the same
  severities, and formatting keeps the settings the previous formatter used. Every package here is
  touched by the dependency removal or by the one-pass reformat, so each takes a patch bump; no
  runtime behaviour changes.

  For anyone consuming the shared configuration: the lint config package is renamed, and the lint
  and format commands changed.

- Updated dependencies [f669d4a]
- Updated dependencies [2405d9e]
- Updated dependencies [b0e66b6]
- Updated dependencies [2609293]
- Updated dependencies [8993cf7]
- Updated dependencies [886e1e7]
- Updated dependencies [1964e9d]
- Updated dependencies [87275f6]
- Updated dependencies [c10e3b6]
  - @caisson/kernel@0.9.0
  - @caisson/jobs@0.7.3
  - @caisson/tenancy-rls@0.6.0
  - @caisson/registry-schema@0.5.11

## 0.6.1

### Patch Changes

- Updated dependencies
  - @caisson/registry-schema@0.5.10

## 0.6.0

### Minor Changes

- f3c62cc: Credits gains a browser-safe `./browser` entry point: the grant and debit event vocabulary and
  `planFifoDebit`, the FIFO waterfall the wallet's own `debit()` walks, can now be imported inside a
  client bundle. Given a list of grant remainders and an amount it returns which grant each credit
  comes off, plus how much the remainders cover and how much they fall short. It reads and writes no
  wallet, so nothing that touches a database or a tenant connection is on the new entry: `grant`,
  `debit`, `clawback`, the balance and ledger reads, the expiry sweeps, and the schema SQL all stay
  on the main entry, which is unchanged and still carries every browser-entry export. Credit amounts
  are integers as before and no wallet, ledger, or 402 behavior changes: the server now calls the
  same shared waterfall instead of its own copy, so a balance or a shortfall shown by a client is the
  one a real debit computes. The site's credits interactive demo runs that shared logic directly
  instead of a hand-maintained copy. The planner validates every supplied remainder before doing
  money arithmetic, so malformed or fractional values fail closed instead of poisoning the reported
  coverage, while drained and negative lines contribute no draw.

### Patch Changes

- Updated dependencies [7d74f8f]
- Updated dependencies [742c979]
  - @caisson/kernel@0.8.0
  - @caisson/jobs@0.7.2
  - @caisson/registry-schema@0.5.9
  - @caisson/tenancy-rls@0.5.8

## 0.5.11

### Patch Changes

- Updated dependencies [e917c52]
- Updated dependencies [e917c52]
- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/registry-schema@0.5.9
  - @caisson/kernel@0.7.0
  - @caisson/jobs@0.7.1
  - @caisson/tenancy-rls@0.5.7

## 0.5.10

### Patch Changes

- Updated dependencies [25fd03c]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [a21c478]
- Updated dependencies [108a358]
  - @caisson/registry-schema@0.5.8
  - @caisson/kernel@0.6.0
  - @caisson/jobs@0.7.0
  - @caisson/tenancy-rls@0.5.6

## 0.5.9

### Patch Changes

- Updated dependencies [31d59fd]
  - @caisson/registry-schema@0.5.7

## 0.5.8

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/jobs@0.6.3
  - @caisson/kernel@0.5.3
  - @caisson/registry-schema@0.5.6
  - @caisson/tenancy-rls@0.5.5

## 0.5.7

### Patch Changes

- Updated dependencies [2229209]
  - @caisson/registry-schema@0.5.5

## 0.5.6

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/jobs@0.6.2
  - @caisson/tenancy-rls@0.5.4

## 0.5.5

### Patch Changes

- Updated dependencies [5d03808]
- Updated dependencies [7de6fa4]
  - @caisson/registry-schema@0.5.4
  - @caisson/kernel@0.5.1
  - @caisson/jobs@0.6.1
  - @caisson/tenancy-rls@0.5.3

## 0.5.4

### Patch Changes

- Updated dependencies [f40653b]
- Updated dependencies [c3b0e41]
  - @caisson/registry-schema@0.5.3
  - @caisson/jobs@0.6.0

## 0.5.3

### Patch Changes

- Updated dependencies [5a09b01]
  - @caisson/registry-schema@0.5.2

## 0.5.2

### Patch Changes

- Updated dependencies [3f05e1e]
  - @caisson/registry-schema@0.5.1

## 0.5.1

### Patch Changes

- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0
  - @caisson/jobs@0.5.1
  - @caisson/tenancy-rls@0.5.2
  - @caisson/registry-schema@0.5.0

## 0.5.0

### Minor Changes

- 230f02a: Added a "Buy credits" button on the Credits dashboard page, so a 5,000-credit top-up pack can be
  purchased directly instead of needing to contact support. Also fixed the "Current balance" tile so
  it never overstates what you can actually spend: it now reflects your real spendable total right
  away, rather than briefly counting expired credits until the next daily cleanup runs.
- a79acb4: Add `outstandingClaw`, a shared account+purchase-scoped advisory-lock guard around the
  `creditsGrantedBySource`/`creditsClawedForSource` read that every purchase-clawback caller now
  routes through. Closes a read-then-claw race: two differently-keyed clawback attempts against the
  same purchase (a whole-transaction refund, a per-line adjustment, and an operator revoke can all
  key differently) could previously each read a stale "already clawed" amount and, once the wallet's
  own balance-clamp kicked in, drain an unrelated purchase's unspent credits out of the same fungible
  wallet. The lock serializes racing readers so the second always observes the first's committed
  claw.

### Patch Changes

- Updated dependencies [3d23da7]
- Updated dependencies [2b65cf3]
- Updated dependencies [9a81dd7]
- Updated dependencies [a0aa9a3]
- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
- Updated dependencies [99d665a]
- Updated dependencies [ab352ab]
- Updated dependencies [4d85f28]
  - @caisson/registry-schema@0.5.0
  - @caisson/jobs@0.5.0
  - @caisson/kernel@0.4.3
  - @caisson/tenancy-rls@0.5.1

## 0.4.1

### Patch Changes

- Updated dependencies [8170382]
- Updated dependencies [8c53ca3]
- Updated dependencies
  - @caisson/registry-schema@0.4.0
  - @caisson/tenancy-rls@0.5.0
  - @caisson/jobs@0.4.1

## 0.4.0

### Minor Changes

- ad02304: The cli codegen debit is decoupled behind a required `DebitFn` injection port (`GenerationDeps.debit`; `@caisson/credits` moves to devDependencies and off the manifest), and `@caisson/credits` flips commercial at $149 (tier `paid`, priceCents 14900, `LicenseRef-Caisson-Commercial`).
- 4d7eb71: Grant-level credit expiry + materialized FIFO burn. Every grant now stamps
  `expires_at` (default issue + 12 months, overridable per grant class via `GrantInput.expiresAt`);
  `debit()` walks unexpired grants in FIFO burn order (`created_at, expires_at, id`) and records the
  consumption trail in the new append-only `grant_consumption` table, splitting across grants and
  never drawing from an expired grant (402 even when the raw wallet aggregate is larger). New:
  `CREDIT_EXPIRY_MIGRATION_SQL` + `GRANT_CONSUMPTION_MIGRATION_SQL` (apply after the existing credit
  migrations wherever the table is bootstrapped), `expiringSoon()` (the 30-day dashboard badge read),
  the idempotent `sweepExpiredGrants()` residue burn (new `expiry_debit` ledger event type), the
  notified-once `sweepExpiryNotices()` T-30d email sweep, and `@caisson/jobs` task wrappers
  (`defineCreditExpirySweepTask` / `defineCreditExpiryNoticeTask` + enqueue helpers).

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [d6cc28e]
- Updated dependencies [0c883ae]
- Updated dependencies [2834c3f]
- Updated dependencies [41e07b6]
- Updated dependencies [850b844]
- Updated dependencies [4d7eb71]
- Updated dependencies [31d6a41]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
  - @caisson/jobs@0.4.0
  - @caisson/kernel@0.4.2
  - @caisson/registry-schema@0.3.0
  - @caisson/tenancy-rls@0.4.0

## 0.3.2

### Patch Changes

- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1
  - @caisson/tenancy-rls@0.3.2

## 0.3.1

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0
  - @caisson/tenancy-rls@0.3.1

## 0.3.0

### Minor Changes

- ccf8b10: Branded money types + rounding provenance (ADR-0212).
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

- 95103b6: Money-path hardening. `parsePaddleEvent` now correlates
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

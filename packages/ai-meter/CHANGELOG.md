# @caisson/ai-meter

## 0.3.4

### Patch Changes

- Updated dependencies [8c53ca3]
- Updated dependencies
  - @caisson/tenancy-rls@0.5.0
  - @caisson/credits@0.4.1

## 0.3.3

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- dec93f3: Added the missing `anthropic/claude-sonnet-4.5` price-book row (input $3.00 / output $15.00 per
  MTok) — Sonnet-tier usage was fail-closed with a `ConfigError` for lack of a rate, blocking all
  metering of that tier.
- 4d7eb71: Test-double bootstrap sweep for the credit-expiry migrations: every credit-table
  bootstrap now applies `CREDIT_EXPIRY_MIGRATION_SQL` + `GRANT_CONSUMPTION_MIGRATION_SQL` (the
  `debit()` FIFO path reads `expires_at` and writes `grant_consumption`). No runtime source change
  in these packages.
- 850b844: Add a README to each of these four packages, documenting the functions and types they
  actually export with a runnable usage example for each. No behavior changes.
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy, and regenerated a couple of stale public-surface sections against the actual
  exports. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [0c883ae]
- Updated dependencies [ad02304]
- Updated dependencies [4d7eb71]
- Updated dependencies [0af4dbf]
  - @caisson/credits@0.4.0
  - @caisson/kernel@0.4.2
  - @caisson/tenancy-rls@0.4.0

## 0.3.2

### Patch Changes

- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1
  - @caisson/tenancy-rls@0.3.2
  - @caisson/credits@0.3.2

## 0.3.1

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0
  - @caisson/credits@0.3.1
  - @caisson/tenancy-rls@0.3.1

## 0.3.0

### Minor Changes

- 959e555: Pre-call MinHash/LSH dedup-before-meter gate (ADR-0217): new `src/dedup.ts` (`normalizePrompt`,
  `shingle`, `computeMinHashSignature`, `lshBands`, `jaccardEstimate`, `createInMemoryDedupStore`,
  `checkDedupGate`), all exported from `index.ts`. `reserve()`'s idempotency only catches a literal
  `callId` retry — this detects a near-identical prompt (an agent loop rewording a retry, a re-asked
  question) BEFORE the price-book estimate/debit, so a caller (ai-kit gateway, agent-runner,
  support-bot) can choose to skip or reuse instead of paying twice. Detection only — no auto-skip,
  no policy enforcement, zero wallet movement (`dedup.ts` imports nothing from `@caisson/credits`).
  Zero edits to `meter.ts`/`schema.ts`/`breaker.ts`/`pricebook.ts` beyond a one-line JSDoc pointer on
  `reserve()`; no new dependency, no new Postgres table/migration, no manifest change.
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

### Patch Changes

- Updated dependencies [b5915e0]
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [afa6070]
- Updated dependencies [95103b6]
- Updated dependencies [aaff518]
- Updated dependencies [549dd4e]
  - @caisson/tenancy-rls@0.3.0
  - @caisson/kernel@0.3.0
  - @caisson/credits@0.3.0

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- 33bee35: BYOK (tenant-key) inference now
  makes zero wallet movement while internal metering still runs;
  provider-unreported token usage is kept distinct from genuine zero so reconcile settles at
  the reserved estimate instead of silently refunding a real call; the spend-window bucket is
  fixed at reserve and reused at reconcile so boundary-straddling calls no longer undercount
  the hard-cap breaker. Alerting webhook/Slack/Telegram destinations get an https-only +
  private/metadata-range SSRF guard at both the Zod boundary and the fetch seam, mirroring the
  ai-kit baseUrl policy. The retention_audit table gets fail-closed RLS via an append-only
  follow-up migration. The pg-boss production job driver now validates task name + payload
  schema on enqueue like its sibling drivers.
- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
  - @caisson/credits@0.2.0
  - @caisson/tenancy-rls@0.2.0

# @caisson/ai-meter

## 1.1.3

### Patch Changes

- Updated dependencies [498b279]
- Updated dependencies [cd694f1]
- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/tenancy-rls@0.6.1
  - @caisson/ui@0.6.7
  - @caisson/kernel@0.10.0
  - @caisson/credits@0.6.3

## 1.1.2

### Patch Changes

- b0e66b6: Clarify the internal module boundaries for local embed scrubbing and AI token-rate normalization. Public exports and runtime behavior are unchanged.
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
- Updated dependencies [886e1e7]
- Updated dependencies [e190797]
- Updated dependencies [87275f6]
  - @caisson/kernel@0.9.0
  - @caisson/ui@0.6.6
  - @caisson/tenancy-rls@0.6.0
  - @caisson/credits@0.6.2

## 1.1.1

### Patch Changes

- @caisson/credits@0.6.1

## 1.1.0

### Minor Changes

- e19da1d: ai-meter gains a browser-safe `./browser` entry point: the versioned price book with its integer
  cost normalizer, the pre-call token estimator, and the spend vocabulary — the default scope, the
  breaker's state shape, and the `SpendCapError` a capped tenant raises — can now be imported inside
  a client bundle. The database-bound half is deliberately absent from it: `reserve()`,
  `reconcile()`, the stored circuit breaker and the schema all stay on the main entry, which is
  otherwise unchanged and still carries the complete surface. Every name on the browser entry is also
  available there, and no existing import moves or changes behavior. The site's ai-meter interactive
  demo now prices its sample calls through that real code instead of a hand-maintained copy.

### Patch Changes

- Updated dependencies [98bf1f3]
- Updated dependencies [68df709]
- Updated dependencies [7d74f8f]
- Updated dependencies [f3c62cc]
  - @caisson/ui@0.6.5
  - @caisson/kernel@0.8.0
  - @caisson/credits@0.6.0
  - @caisson/tenancy-rls@0.5.8

## 1.0.11

### Patch Changes

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
- Updated dependencies [b5cd9d6]
  - @caisson/kernel@0.7.0
  - @caisson/ui@0.6.4
  - @caisson/credits@0.5.11
  - @caisson/tenancy-rls@0.5.7

## 1.0.10

### Patch Changes

- 96aa01d: Make price authority total over every sellable commercial module and bundle, remove the old $49
  placeholder exemption, mark retired aliases as non-sellable, and pin the current $1,649 Compliance
  price in component demos and fulfillment coverage.
- Updated dependencies [6d1c805]
- Updated dependencies [a00a9ef]
- Updated dependencies [96aa01d]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [2cd4184]
- Updated dependencies [6d1c805]
- Updated dependencies [56e46f1]
  - @caisson/ui@0.6.3
  - @caisson/kernel@0.6.0
  - @caisson/credits@0.5.10
  - @caisson/tenancy-rls@0.5.6

## 1.0.9

### Patch Changes

- @caisson/credits@0.5.9

## 1.0.8

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [cd48b89]
- Updated dependencies [bd071c9]
- Updated dependencies [c36b9e2]
  - @caisson/ui@0.6.2
  - @caisson/credits@0.5.8
  - @caisson/kernel@0.5.3
  - @caisson/tenancy-rls@0.5.5

## 1.0.7

### Patch Changes

- @caisson/credits@0.5.7

## 1.0.6

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/credits@0.5.6
  - @caisson/tenancy-rls@0.5.4

## 1.0.5

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/credits@0.5.5
  - @caisson/tenancy-rls@0.5.3

## 1.0.4

### Patch Changes

- 9d50e7c: The AI kit gains `runToolLoop` — a bounded, governed agent tool loop. Each model step and
  each tool execution reserves credits before it runs and settles to actuals after (the same
  debit-before-spend ledger every gateway call uses), with a hard step ceiling, a caller-side
  integer credit budget that fails the run closed when the next step cannot fit, and a full
  append-only trajectory of the run (prompts, tool arguments, and results travel as content
  digests, never bodies). Tools are executed by the loop itself between model steps, so a
  declined reservation or an exhausted budget stops execution before any spend. The meter
  now also accepts a zero output-token bound on reservations, which lets non-generating
  actions take a zero-credit, cap-checked reservation.
  - @caisson/credits@0.5.4

## 1.0.3

### Patch Changes

- @caisson/credits@0.5.3

## 1.0.2

### Patch Changes

- @caisson/credits@0.5.2

## 1.0.1

### Patch Changes

- Updated dependencies [e5e4311]
- Updated dependencies [809592d]
- Updated dependencies [809592d]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0
  - @caisson/ui@0.6.1
  - @caisson/credits@0.5.1
  - @caisson/tenancy-rls@0.5.2

## 1.0.0

### Minor Changes

- 1bc677a: Add an optional embeddable usage chart at the `@caisson/ai-meter/ui` subpath. It rolls your metered
  inference events up by model into credit, cost, and token totals, then draws a per-model spend bar
  chart and a numeric breakdown table. Credits and cost stay integer units end to end. The surface
  renders only the events you hand it — no database, no meter call. Presentational and server-render
  safe; composes the `@caisson/ui` kit. Importing the package root stays React-free.

### Patch Changes

- Updated dependencies [08fd857]
- Updated dependencies [230f02a]
- Updated dependencies [a79acb4]
- Updated dependencies [0137008]
- Updated dependencies [2b65cf3]
- Updated dependencies [5a8b317]
- Updated dependencies [8253e76]
- Updated dependencies [f903014]
- Updated dependencies [eff7248]
- Updated dependencies [47e04fd]
- Updated dependencies [51e3ed0]
- Updated dependencies [b5a3690]
- Updated dependencies [b5a3690]
- Updated dependencies [51e3ed0]
- Updated dependencies [c905c61]
- Updated dependencies [2c93128]
- Updated dependencies [b7e58a8]
- Updated dependencies [b43959c]
  - @caisson/ui@0.6.0
  - @caisson/credits@0.5.0
  - @caisson/kernel@0.4.3
  - @caisson/tenancy-rls@0.5.1

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

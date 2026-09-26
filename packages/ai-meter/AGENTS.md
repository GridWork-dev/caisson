# AGENTS — @caisson-sh/ai-meter

Agent-facing authoring/usage contract (ADR-0020 `agents`). What a generation agent or the AI
Production Kit gateway must know to meter inference correctly.

## Invariants (do not violate)

- **Reserve BEFORE the provider call; reconcile AFTER.** `reserve()` debits an estimated charge up
  front (debit-before-spend, ADR-0007) and returns `reservedCredits`; `reconcile()` trues that to the
  provider's actual usage. Never call the model before a successful `reserve()`.
- **Both legs run inside `withTenant(accountId)`** (ADR-0005). The meter only takes a `TenantExecutor`
  — RLS scopes every ledger/window/breaker row to the calling tenant. A short wallet throws
  `InsufficientCreditsError` (402) and the whole transaction rolls back: a failed reservation leaves
  NO trace.
- **The breaker is checked first, on every reserve.** An open breaker throws `SpendCapError` (402)
  before any spend. A crossed **hard** cap trips it (fail-closed); it stays open until `resetBreaker`.
- **Idempotency is keyed on `callId`.** Reserve uses `${callId}:reserve`, reconcile is anchored on the
  append-only `usage_event (account, call_id)` UNIQUE (and `${callId}:reconcile`). Pass the SAME
  `callId` on a retry — it settles exactly once. Feed `reserve()`'s `reservedCredits` back into
  `reconcile()`.
- **Integer credits only (ADR-0007).** Cost normalizes through the price book to integer micro-USD,
  then integer credits (per-leg ceil, BigInt internally — never a float). A zero-delta reconcile
  writes no credit row.

## Cost + estimate

- `computeCost(usage, entry, conversion)` is the single normalizer; the rounding is pinned by
  `src/__golden__/cost.json` (ADR-0013, update only via `BLESS=1`). `cachedInputTokens` is the
  cache-read SUBSET of `inputTokens`; the remainder bills at the full input rate.
- `estimateTokens` is `ceil(chars / 4)`; the reservation assumes a full output budget and **no cache**
  so it never under-reserves. The estimate only sizes the hold — reconcile is the source of truth.

## Price book

`BUNDLED_PRICE_BOOK` (versioned, `PRICE_BOOK_VERSION`) is `forge.config`-overridable: validate an
override through `parsePriceBook` / `parseCreditConversion` at the edge. An unknown `provider/model`
throws `ConfigError` — it never meters silently at zero.

## Dedup-before-meter gate

`checkDedupGate(store, config)` (ADR-0217) catches a near-identical prompt retry — an agent loop
rewording the same question, a re-asked question — BEFORE the price-book estimate/debit, so a
caller (ai-kit gateway, agent-runner, support-bot) can choose to skip or reuse instead of paying
twice. Built from `normalizePrompt`/`shingle`/`computeMinHashSignature`/`lshBands`/`jaccardEstimate`
(pure MinHash/LSH similarity, no network) over an injected `DedupStore`
(`createInMemoryDedupStore` for tests/single-process). Detection only — it never auto-skips or
enforces a policy, and moves zero wallet balance; `reserve()`'s own idempotency separately catches
a literal `callId` retry.

## Entry points

Three: `.` is the full node-capable surface, `./ui` is the usage chart, and `./browser` is the
browser-safe subset — the price book + cost normalizer, the estimator, and the spend-policy
vocabulary (`DEFAULT_SCOPE`, `BreakerState`, `SpendCapError`). A client bundle imports `./browser`,
never `.`. `reserve()`/`reconcile()`, the stored breaker and the DDL are deliberately absent from
it: they take a `TenantExecutor` and move a real wallet. A module joins `./browser` only if its
whole value-import graph passes the package's static source-graph walk
(`src/browser-safety.test.ts` — never a bundler exit code), and every `./browser` name must also
exist on `.`.

## Out of scope

No provider-SDK import (the gateway `@caisson-sh/ai-kit` owns that boundary, ADR-0011/0059). No live
model/network call — the meter is provider-agnostic and prices a usage shape, not a transport. This
is the base primitive the AI Production Kit gateway composes (ADR-0003); it never imports an edition.

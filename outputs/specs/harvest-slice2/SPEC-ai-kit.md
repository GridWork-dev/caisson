# SPEC — `@caisson/ai-kit` (deadline-bound transports + metered embeddings)

**Status: EXECUTED — ADR-0213 (metered embeddings surface) + ADR-0210 (harden-in-place), harvest slice-2 wave, 2026-07-02 operator picker, shipped PR #47.**

**Package:** `packages/ai-kit` (commercial AI Production Kit edition; `kind: "edition"`, down-only per ADR-0003).
**Type:** HARDEN (fetch-deadline floor gap) + EXTEND (`embed()`/`embedMany()` through the existing gateway chokepoint).
**Tags:** `security` `ai`.

## Goal (WHAT + WHY)

`providers.ts` builds every live `@ai-sdk/*` adapter (openai/anthropic/azure/google/bedrock/openai-compatible ×2)
without a custom `fetch`, and `infer()` calls `generateText` with no `abortSignal` — a live call can hang the
process unbounded, violating the fetchWithTimeout-on-every-outbound-fetch floor. Separately, `infer()`/
`inferStream()` are the ONLY metered AI surface ai-kit ships; a buyer building RAG/semantic-search needs metered,
BYOK-aware **embeddings** through the same reserve-before/reconcile-after chokepoint instead of an unmetered
vendor call.

## Scope

**In:** deadline-bound `fetch` in all 7 provider factories (configurable `timeoutMs`); `abortSignal` on
`InferOptions` → `generateText` (parity with `inferStream`'s `streamText`); a new `embed()`/`embedMany()` pair,
same chokepoint contract.

**Out:** guardrails on embed input/output (feeds a vector index, not user text — input-PII-before-embed
deferred); `promptRef` templating for embed (raw strings only); any edit to `packages/ai-config`/`ai-meter`/
`pricebook` — a bundled price-book row and any flat commerce-action SKU are cross-package money for a later wave
(open question below; buyers price their own lane today via `MeterConfig.priceBook`, as with any unbundled chat
model); a per-lane `timeoutMs` on ai-config's `ProviderConfig` (base package — use a construction-time param).

## Design

- **`providers.ts`:** `timeoutFetch(timeoutMs): typeof fetch` wraps `fetchWithTimeout` (`@caisson/kernel`) to the
  AI-SDK `fetch` option; `DEFAULT_PROVIDER_TIMEOUT_MS = 60_000`. `providerFor(cfg, keyOverride?, timeoutMs =
DEFAULT)` passes it into every `create*` call (both `createOpenAICompatible` branches too); `defaultProviders(
settings, timeoutMs?)` and `byok-resolver.ts`'s `ByokResolverOptions.timeoutMs?` thread it through.
- **`gateway.ts`:** `InferOptions.abortSignal?: AbortSignal` → `generateText({ …, abortSignal })`, mirroring
  `inferStream`'s wiring; a hang still hits the existing `catch → settle(ZERO_USAGE)` refund path unchanged.
- **`embed.ts` (new, mirrors `gateway.ts` minus render/guard):** `EmbeddingModelResolver = (lane, accountId?) =>
EmbeddingModelV2 | Promise<…>`; `buildEmbeddingRegistryResolver(settings, providers)` →
  `registry.textEmbeddingModel("${provider}:${model}")`; `EmbedOptions { tx, accountId, settings, resolveModel,
callId?, meter? }`; `embed(lane, value, opts)` / `embedMany(lane, values, opts)` → `{ callId, embedding(s),
usage, reserved, reconciled }`. Pipeline: `resolveProvider` → `reserve()` over `values.map(v => ({role:"user",
content: v}))` (no `maxOutputTokens` — zod requires `positive()`; the resulting phantom output estimate refunds
  at reconcile regardless of `outputPerMTok`) → AI SDK `embed`/`embedMany` (try/catch → `settle(ZERO_USAGE)` +
  rethrow, as `infer()`) → usage from `EmbeddingModelUsage.tokens` → `{inputTokens, cachedInputTokens: 0,
outputTokens: 0}` (chars/4 fallback on no-report) → `reconcile()` with `keySource` passthrough (BYOK zeroes
  unconditionally, identical to `infer()` — `packages/pricebook`'s allowlist governs flat actions only).
  Price-key stays `provider/model` — an embedding model is just another `PriceBook` row; no `PriceBookEntry`
  schema change.

## Tasks

1. `providers.ts`: deadline fetch + `timeoutMs` on `providerFor`/`defaultProviders`; thread through
   `byok-resolver.ts`. Verify: `bun test packages/ai-kit/src/providers.test.ts`.
2. `gateway.ts`: `abortSignal` on `InferOptions` → `generateText`. Verify: `bun test packages/ai-kit/src/gateway.test.ts`.
3. New `src/embed.ts` (`embed`/`embedMany` + resolver + types); export from `index.ts`. Verify: `bunx tsc -p packages/ai-kit/tsconfig.json --noEmit`.
4. `src/embed.test.ts`: happy path, BYOK $0-debit, provider-failure refund, no-reported-usage fallback, `embedMany`
   sizing. Verify: `bun test packages/ai-kit/src/embed.test.ts`.
5. `providers.test.ts`: stalling-fetch-stub proving `timeoutMs` aborts a hung request. Verify: same file's suite.
6. `live/embed.live.test.ts` mirroring `gateway.live.test.ts`'s skip-without-key convention. Verify:
   `OPENROUTER_API_KEY=… bun run test:live`.
7. Docs (`AGENTS.md`/`README.md`) + changeset naming `@caisson/ai-kit` (`patch`). Verify: `bun run check -F
@caisson/ai-kit` + `bunx changeset status --since=origin/main`.

## Verify (goal-backward)

- Every live `create*` call receives a `fetch` bound by `timeoutMs`; a stalling-stub test proves the deadline
  fires instead of hanging.
- `infer()` forwards `abortSignal` like `inferStream()`; an aborted call still settles (refunds), never leaks a
  reservation.
- `embed()`/`embedMany()` reserve BEFORE the call, reconcile to actual, zero-debit on `keySource: "tenant"` —
  proven over PGlite, zero live calls in CI.
- `packages/ai-config`/`ai-meter`/`pricebook` show zero diff lines; `bun run check` green.

## Open question

Should a real embedding model earn a bundled `@caisson/ai-meter` price-book row, and/or a flat
`packages/pricebook` action (e.g. `embedBatchCredits`) for a bulk-embed SKU? Both are cross-package money edits —
deferred to the wave owning those packages.

## Effort / Value

**Effort:** S–M (~1 day). **Value:** HIGH — closes a hang/DoS-adjacent floor violation on every live provider
path; metered embeddings is a materially requested RAG capability built almost entirely from proved machinery
(registry resolver, BYOK, reserve/reconcile).

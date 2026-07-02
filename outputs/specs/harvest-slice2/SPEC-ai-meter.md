# SPEC — `@caisson/ai-meter` pre-call MinHash/LSH dedup-before-meter gate

**Status: LOCKED — ADR-0217, harvest slice-2 wave, 2026-07-02 operator picker.**

- **Package:** `packages/ai-meter` (`LicenseRef-Caisson-Commercial`, `paid` tier, `kind: primitive`
  base — never an edition, ADR-0003).
- **Source (throughframe lift-sweep #12, rebuild-clean — patterns only):** MinHash/LSH
  near-duplicate detection is a standard technique (Broder et al.); no source file to port.
- **Type:** NEW CAPABILITY, additive-only (ADR-0210 lock 2, ADR-0217) — lands inside this existing
  package; `manifest.ts` deps/license/tier/edition-membership unchanged. **Tags:** `ai`.

## Goal (WHAT + WHY)

`reserve()`'s idempotency (`usage_event (account, call_id)` UNIQUE) catches only a literal retry
of the SAME call; provider `cached_input_tokens` is a billing-rate field. Neither catches two
_different_ calls whose prompts are near-identical (an agent loop rewording a retry, a user
re-asking the same question) — each pays a fresh reservation + provider call. The gate detects a
likely-redundant prompt BEFORE the price-book estimate/debit, so a caller (ai-kit gateway,
agent-runner, support-bot) can skip or reuse instead of paying twice. ai-meter stays a base
primitive — the gate detects only, never enforces a policy.

## Scope

**In:** MinHash signature over the normalized prompt + LSH-banded candidate lookup against a
bounded recent-window store; injected `DedupStore` port with an in-memory bounded default;
caller-configurable threshold (conservative default); typed `proceed | duplicate-of` result;
export from `index.ts`. **Out:** no auto-skip/auto-reuse (caller decides, never a silent stale
answer); no Postgres-backed store/migration this wave (port admits one later); no cross-tenant
bucket sharing (`accountId`+`scope`-keyed); no `reserve()`/`reconcile()` signature change; no
edition coupling.

## Design

New `src/dedup.ts` only — zero edits to `meter.ts`/`schema.ts`/`breaker.ts`/`pricebook.ts`. Reuses
`EstimateMessage` from `estimate.ts` (the same array a caller passes to `reserve()`). Pure hashing
core (~50 LOC, no dependency, ADR-0217): `normalizePrompt(messages: EstimateMessage[]): string`
(lowercase + whitespace-collapsed joined `content`); `shingle(text, k = 3): string[]` (k-word
sliding shingles); `computeMinHashSignature(shingles, numHashes = 32): Uint32Array` (`numHashes`
independent `(a·h(x)+b) mod p` permutations over one FNV-1a hash, signature = per-function min);
`lshBands(sig, bands = 16, rows = 2): string[]` (band-key strings, `bands*rows === numHashes`);
`jaccardEstimate(a, b: Uint32Array): number` (matching-position fraction).

`interface DedupEntry { callId: string; signature: Uint32Array; at: Date }`; `interface DedupStore
{ candidates(accountId, scope, bucketKeys: string[]): DedupEntry[] | Promise<DedupEntry[]>;
insert(accountId, scope, bucketKeys: string[], entry: DedupEntry): void | Promise<void> }` — every
call `accountId`+`scope` keyed. `createInMemoryDedupStore(capacity = 200): DedupStore` — one
bounded ring buffer per `${accountId}:${scope}`, linear-scanned for bucket-key overlap (ponytail:
capacity is small by design; a real bucket-indexed Map only pays off past a few thousand entries).
`async function checkDedupGate(input: { accountId, scope, callId: string; messages:
EstimateMessage[] }, config: { store: DedupStore; threshold?: number /* default 0.92 */;
numHashes?, bands?, rows?: number }): Promise<DedupGateResult>` — `input` Zod-`strictObject`-
validated (mirrors `reserveCoreSchema`); signature → `store.candidates` → keep the highest
similarity ≥ threshold → THEN `store.insert` its own signature (order matters: never self-match);
returns `{ kind: "proceed" }` or `{ kind: "duplicate-of"; callId; similarity: number; at: Date }`.
**Hook point:** `checkDedupGate()` is caller-invoked BEFORE `reserve()`, not embedded in its
transaction — a `duplicate-of` result lets the caller skip the provider call AND the reservation
(a gate inside `reserve()` would already have debited by the time the result is visible). One
JSDoc line on `reserve()` points integrators at it.

## Tasks

1. `dedup.ts` hashing core (`normalizePrompt`/`shingle`/`computeMinHashSignature`/`lshBands`/
   `jaccardEstimate`). Verify: `bun test packages/ai-meter/src/dedup.test.ts`.
2. `DedupStore` port + `createInMemoryDedupStore()`. Verify: same file — insert → candidates hits
   by shared band, capacity-eviction drops the oldest.
3. `checkDedupGate()` + Zod boundary schema + threshold/near-dup/no-self-match cases. Verify: same file.
4. Export from `index.ts`; one-line JSDoc pointer on `reserve()` (no signature change). Verify:
   `bun run --filter=@caisson/ai-meter build lint test`.
5. Changeset naming `@caisson/ai-meter` (`minor`). Verify: `changeset status --since=origin/main`
   - `bun run check`.

## Verify (goal-backward)

- Near-identical prompts (paraphrase/whitespace variant) → `duplicate-of` at similarity ≥
  threshold, referencing the prior `callId`; unrelated prompts → `proceed`.
- Zero wallet movement (`dedup.ts` imports nothing from `@caisson/credits`); every pre-existing
  `meter.ts`/`meter.integration.test.ts` behavior byte-unchanged.
- No new `package.json`/`manifest.ts` dependency, no new Postgres table or migration.
- `bun run check` green.

## Effort: M (~1 day incl. tests). Value: MEDIUM (cost-avoidance guardrail; not itself revenue-additive).

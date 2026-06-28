# SWEEP — Wave 1 / P5: Generator + registry full drive

Act 5: downstream impact + gap assessment after VERIFY passed. _What else does this change touch?_

## Downstream impact (checked)

- **`apps/base` capstone** — gained a `@caisson/cli` devDep + the exit-gate-4 composition test. The
  existing `app.integration.test.ts` capstone swapped its `registryAllowlist` stub for an empty
  `loadRegistryIndex` (it exercises a read-only tool, never `generate`). No app runtime change.
- **`mcp-server` callers** — `onGenerate`'s contract changed shape (now `{accountId, selection,
idempotencyKey} → {generationId}`). `apps/base/src/app.ts` passes `deps.mcp` straight through, so it
  picked up the new type with no code change; the coach + integration read-only tests updated.
- **`@caisson/registry` dep added** to `mcp-server` (down-only, manifest + package.json in agreement).
  depcruise confirms the module graph stays down-only (no base→edition, no cycle).
- **`recordGeneration` return widened** `{recorded} → {recorded, id}` — additive; `runGeneration`
  surfaces `generationId`. No existing assertion broke (72 cli tests green).

## Gaps / tech-debt surfaced (queued, not silently dropped)

- **meter↔writer import cycle** — found by depcruise during VERIFY (NOT caught by turbo `check`,
  which omits the full module-graph job). Fixed in-phase (`561b3ed`): hoisted `FileSetWriter` into
  `writer.ts`. **Lesson for the cadence:** run `bunx depcruise` locally before SHIP — `bun run check`
  alone does not catch circular/down-only graph violations.
- **`meter.ts` header drift** — its comment claims "Both create-caisson and the buyer MCP call
  runGeneration", but the local CLI generates free-locally (no debit). Logged as the local-debit board
  fork; the comment fix waits on the operator's free-local-vs-thin-client decision.
- **Four deferred seams** (see VERIFY §Deferred) — all on the board with recommendations.

## No-regression confirmations

- `bun run check` 104/104 green across the whole monorepo (not just the touched packages).
- Index byte-identical (`build-index` → clean `git diff`).
- `bun install` lockfile stable.
- No new published port, external sink, or live network in CI.

## Follow-ups for P6/commerce

Publishability flip + registry-publish posture; recurring-cycle → `grant()` mapping + the USD↔credit
price-book (the standing X-2 gap on the board); MCP rate-limit; migration-bundle population.

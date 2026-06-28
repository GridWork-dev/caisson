# VERIFY — Wave 1 / P5: Generator + registry full drive

Goal-backward verification against the SPEC "Goal" + the merged diff. Method: re-ask
_did the code achieve the stated goal_ — not a task checklist. Run-and-read evidence below.

**Verdict: PASS** (with four explicitly-deferred, board-tracked, non-exit-gate seams).

## Exit gate (SPEC §"Exit gate") — all six, with evidence

1. **create-caisson materializes a fixed selection through the real `FileSetWriter` and matches a
   golden; the generated repo carries trimmed CI + goldens + `AGENTS.md` and NO registry/publish/
   gate/eval file (ADR-0072 boundary asserted in the golden).** ✅
   `packages/cli/templates/` + `engine-templates.ts`; goldens `generated-fileset.json` +
   `generated-fileset-compliance.json`; ADR-0072 boundary test. `bun run check` runs the cli suite
   green (72 tests).

2. **PGlite: debit fires before any byte is written; a 402 aborts with nothing on disk; a same-key
   retry debits once and re-materializes; a `generation` audit row is recorded post-debit in the same
   `withTenant` txn.** ✅
   `packages/cli/src/meter.integration.test.ts` (runGeneration: 10 cases incl. ADR-0077 pin
   resolution) **and** the new capstone `apps/base/src/generate.integration.test.ts` proving the
   loop end-to-end through the real MCP: a generate call returns a UUID `generationId`; balance drops
   by exactly one credit; exactly one audit row (superuser ground-truth read); a same-key retry
   returns the SAME id with zero further debit and the row count pinned at one; an insufficient-credit
   account throws `InsufficientCreditsError` with zero rows + untouched balance.

3. **Migration assembler merges per-package fixtures into one ordered sequence + a single
   `schema_version` ledger, byte-matching a golden; entitlement resolver expands an edition → member
   slug set.** ✅
   `packages/cli/src/migrate/assemble.ts` + golden; `expandEntitlements` (ADR-0071) unit-tested and
   wired into both the cli compose path and the MCP entitlement gate.

4. **MCP `generate` validates id+version against the index (not a flat string list), mints an
   idempotency key, drives `runGeneration` (debit + record), returns the file set; every tool gated by
   the resolver-expanded entitlement, fail-closed/timing-safe.** ✅
   `packages/mcp-server/src/server.ts` converged onto `RegistryIndex` (`assertKnownModule` +
   `assertKnownVersion` before any entitlement check or host call, raw miss wrapped as a 400 —
   anti-injection); `expandEntitlements` ownership gate; `randomUUID()` mint / verbatim-reuse (T21a).
   `server.test.ts` (15 cases) proves validate/gate/mint/delegate; the apps/base capstone proves the
   `onGenerate → withTenant + runGeneration` drive closes the debit+record loop.

5. **10 base manifests + `cli` + `field-crypto` pass the standards gate; a test-doubled
   publish-and-index run (no live publish) appends to the ledger + rebuilds `index.json`
   byte-identically, in dependency-topological order.** ✅
   `bun run gate`: 36 checked, all conform (manifest↔package.json agreement). `registry/scripts/
ci-publish-step.ts` + `backfill.ts` (Kahn topo-sort, injected publisher, `CAISSON_PUBLISH_DRY_RUN`).
   `bun registry/scripts/build-index.ts && git diff --exit-code registry/index.json` → **byte-identical**.

6. **`bun install` clean · `bun run check`/`gate` green · goldens matched (BLESS unset) · depcruise
   down-only clean · no live network/cloud/model/publish in CI · PR open · no DEPLOY.** ✅
   `bun install` → lockfile stable. `bun run check` → **104/104** turbo tasks + gate clean.
   `bunx depcruise packages apps tooling` → **no violations** (603 modules) — note this caught a
   `meter↔writer` type cycle, fixed in-phase (`561b3ed`). No live publish/network in CI
   (`CAISSON_PUBLISH_DRY_RUN` default; `GITHUB_TOKEN`-only publish job gated `needs:[check,gate,index]`).
   No service restarted.

## Goal-backward read

The SPEC goal was to drive the Wave-0 generator + registry **seams to completion** so both
`create-caisson` (CLI) and the buyer MCP compose a runnable, testable buyer repo from a registry
selection — debit-before-spend, path-safe atomic write, byte-identical index. The merged diff does
exactly this and proves the money-critical path (debit precedes any write; 402 writes nothing;
retries debit once) with PGlite run-and-read evidence through the real MCP surface. Goal achieved.

## Deferred (board forks, none exit-gate-blocking)

1. **Publishability flip (T2/T3)** — packages stay `private`; the registry-published-vs-bundled
   coherence question + the repo-wide changeset-presence gate are operator-owned. → P6/commerce.
2. **Compose-time migration bundling (ADR-0070)** — the `import.meta.url`-anchored `migrations-bundle/`
   is empty today, so the merge is a clean deterministic no-op (assembler byte-matches its golden).
3. **`@caisson/migrate` promotion (ADR-0070)** — assembler lives in `cli/src/migrate`; a one-line
   import flip when promoted.
4. **MCP per-account rate-limit (T21b)** — debit-before-spend is the primary abuse control;
   token-bucket is defense-in-depth.

All four logged in `docs/state/decisions-and-forks.md` with recommendations + confidence.

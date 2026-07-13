---
phase: ai-sdk-v7-migration
project: caisson
issue: CAISSON-106
spec: outputs/specs/ai-sdk-v7-migration/SPEC.md
created: 2026-07-13
status: accepted
lock_gate: operator
tags: [ai, billing]
---

# Plan — AI SDK v7 lockstep migration

## Stop Condition

This plan is not executable until the operator accepts `outputs/specs/ai-sdk-v7-migration/SPEC.md` and locks the direct-dependency matrix. The current planning and debt branch must not receive AI SDK migration product code.

## Current-State Map

- `packages/ai-kit/package.json:24-41` owns `ai@^5.0.206` plus the seven direct provider packages.
- `apps/ai-kit/package.json:15-16` directly imports only the provider type contract.
- `packages/ai-kit/src/gateway.ts:191-215` owns language-model registry resolution and usage normalization.
- `packages/ai-kit/src/gateway.ts:239-369` owns non-streaming reserve, provider call, usage mapping, output guard, and reconcile.
- `packages/ai-kit/src/gateway.ts:436-598` owns streaming reserve, finish usage, abandonment estimation, and exactly-once settlement.
- `packages/ai-kit/src/embed.ts:94-126` owns embedding registry resolution and token normalization.
- `packages/ai-kit/src/providers.ts:18-221` owns every live provider factory and `fetchWithTimeout` injection.
- `packages/ai-kit/src/providers.test.ts:150-230` pins OpenAI-compatible vendors to the chat-completions path.
- `packages/ai-kit/src/gateway.test.ts:100-183` defines v5 mock and stream usage shapes; `:298-330`, `:520-596`, and `:598-1005` pin billing outcomes.
- `packages/ai-kit/src/gateway.integration.test.ts:222-435` proves append-only ledger settlement and render-to-usage-to-eval attribution.
- `packages/ai-kit/src/embed.test.ts:67-103` defines v5 embedding usage mocks; `:162-260` pins metering behavior.
- `tooling/eslint-config/boundaries.js:43-49` and its test enforce the provider SDK import boundary.
- `packages/ai-evals/__evals__/baseline.json` is the ADR-0062 regression authority; `bun run eval` is the required non-blessing gate.

## Locked Execution Shape

Execution uses the active orchestrator on one fresh branch from then-current `main`. Code-writing and test-writing stay main-thread because the migration is a context-bearing money seam. Read-only review dispatches use explicit `gpt-5.6-sol`; no Fable fan-out is permitted.

Each task is one atomic commit. The v6 checkpoint is committed and green before the v7 dependency edit begins.

## Task 1 — Start from clean main and freeze the package matrix

**SPEC:** Acceptance Criteria 1-2, 8, 10

**Route:** `capability=code_write`, `role=active-orchestrator`, `lane=main`, `model=current-session`, `concurrency=serial`, `isolation=fresh-worktree`, `permission_profile=workspace`, `evidence=inventory-and-lockfile`

**Files:** read `package.json`, `packages/ai-kit/package.json`, `apps/ai-kit/package.json`, `bun.lock`, `docs/adr-index.md`, and all AI SDK import sites; create no product file.

1. Begin only after this planning PR is merged and the operator has changed both planning documents to `status: accepted`.
2. Create a fresh execution branch from current `origin/main`; do not continue from the planning/debt branch.
3. Verify the ADR ceiling on current main is still 0329. Do not file an ADR unless execution exposes a product or money-policy decision not already bound by ADR-0059, ADR-0060, ADR-0062, or ADR-0213.
4. Re-run the complete import and manifest inventory. The expected direct matrix is `ai`, Bedrock, Anthropic, Azure, Google, OpenAI, OpenAI-compatible, and provider. `provider-utils` remains transitive and `react` remains absent unless the operator explicitly changes the lock.
5. Record resolved `ai-v6` and `latest` dist-tags plus peer ranges in the task notes before editing dependencies. Stop if the registry package matrix conflicts with the accepted SPEC.

**Verify:**

```bash
git status --short --branch
rg -n -e '@ai-sdk/' -e 'from "ai"' -e "from 'ai'" packages apps services --glob '!packages/cli/templates/**'
rg -n 'ADR-0329|ceiling 0329' docs/adr-index.md docs/state/decisions-and-forks.md
```

Expected: clean execution branch; imports remain confined to the sanctioned AI surfaces; ceiling evidence names 0329; no template path appears.

**Commit:** none; this is the precondition for Task 2.

**Depends on:** operator lock and planning PR merge.

## Task 2 — Characterize the v5 money seam with a golden

**SPEC:** Acceptance Criteria 3-6

**Route:** `capability=test_write`, `role=active-orchestrator`, `lane=main`, `model=current-session`, `concurrency=serial`, `isolation=current-worktree`, `permission_profile=workspace`, `evidence=golden-and-red-green-tests`

**Files:**

- Add `packages/ai-kit/src/usage.ts`.
- Add `packages/ai-kit/src/usage.test.ts`.
- Add `packages/ai-kit/src/__golden__/usage-accounting.json`.
- Modify `packages/ai-kit/src/gateway.ts` and `packages/ai-kit/src/embed.ts` only to route SDK usage through the internal adapter.

1. Write failing tests for a pure internal adapter that returns Caisson's `Usage | null` and never exposes an AI SDK type outside `@caisson/ai-kit`.
2. Cover reported, cache-read, zero, unreported, negative/non-finite defensive, and embedding usage. Clamp cache-read tokens to input tokens and all integer fields to non-negative finite integers.
3. Build a deterministic integration evidence object from the existing gateway and embedding fixtures covering:

```ts
type UsageGolden = {
  generateReported: { usage: Usage; actualCredits: number; ledgerRows: number };
  generateCached: { usage: Usage; actualCredits: number; ledgerRows: number };
  generateZero: { usage: Usage; refundedCredits: number; ledgerRows: number };
  generateUnreported: {
    actualEqualsReserved: boolean;
    refundedCredits: number;
  };
  generateFailed: { chargedCredits: number; leakedReservation: boolean };
  streamFinished: { usage: Usage; actualCredits: number; ledgerRows: number };
  streamAbandoned: {
    usedEstimate: boolean;
    ledgerRows: number;
    leakedReservation: boolean;
  };
  embedding: { usage: Usage; outputCredits: number; actualCredits: number };
};
```

4. Record the initial fixture with `BLESS=1`, inspect every integer and ledger count, then rerun without `BLESS`. This is the pre-migration characterization baseline, not permission to bless later drift.
5. Keep the gateway's public return types and reserve/reconcile calls unchanged.

**Verify:**

```bash
BLESS=1 bun test packages/ai-kit/src/usage.test.ts packages/ai-kit/src/gateway.test.ts packages/ai-kit/src/embed.test.ts
bun test packages/ai-kit/src/usage.test.ts packages/ai-kit/src/gateway.test.ts packages/ai-kit/src/embed.test.ts
bun run --filter @caisson/ai-kit build
git diff --check
```

Expected: first command writes only `packages/ai-kit/src/__golden__/usage-accounting.json`; second command matches it; targeted build and diff check exit 0.

**Commit:** `test(ai-kit): pin sdk usage accounting`

**Depends on:** Task 1.

## Task 3 — Migrate v5 to a green v6 checkpoint

**SPEC:** Acceptance Criteria 1-8

**Route:** `capability=code_write`, `role=active-orchestrator`, `lane=main`, `model=current-session`, `concurrency=serial`, `isolation=current-worktree`, `permission_profile=workspace`, `evidence=v6-build-test-eval-checkpoint`

**Files:** modify `packages/ai-kit/package.json`, `apps/ai-kit/package.json`, `bun.lock`, `packages/ai-kit/src/{gateway,embed,providers,byok-resolver,usage}.ts`, their tests, and only compile-proven affected AI surface files.

1. Set the v6 checkpoint ranges from the accepted matrix: `ai@^6`, Bedrock `^4`, Anthropic `^3`, Azure `^3`, Google `^3`, OpenAI `^3`, OpenAI-compatible `^2`, and provider `^3`; align the reference app's provider range with the same provider major.
2. Run `bun install`, then run the focused build before any product edit and retain the expected type failures as RED evidence.
3. Preview the version-specific codemod with `bunx @ai-sdk/codemod v6 --dry`. Confirm it proposes no `packages/cli/templates/**` edit and no Zod v3 import. Then run `bunx @ai-sdk/codemod v6`; never run `upgrade`.
4. Migrate `LanguageModelV2`, `EmbeddingModelV2`, and provider contracts to the v6 generation required by the installed packages; update mocks from `V2` to `V3` as directed by the official codemod.
5. Move cached-input normalization from the deprecated flat field to `inputTokenDetails.cacheReadTokens`; keep missing usage distinct from reported zero.
6. Use the v6 embedding registry name and types selected by the codemod. Preserve the internal embedding result and input-only billing contract.
7. Preserve every factory's timeout-wrapped fetch and the OpenAI-compatible chat path. Do not accept Azure's default transport change without a regression test proving the intended path for Caisson lanes.
8. Run the focused suite and the full golden without `BLESS`. Fix only differences explained by the v6 API; a money-value change stops the task.

**Verify:**

```bash
bun run --filter @caisson/ai-kit build
bun run --filter @caisson/ai-kit lint
bun run --filter @caisson/ai-kit test
bun run --filter @caisson/ai-kit-app build
bun run --filter @caisson/ai-kit-app test
bun run eval
bun run gate
git diff --check
```

Expected: every command exits 0; the usage golden is byte-identical; the eval baseline is unchanged; provider-boundary checks pass.

**Commit:** `refactor(ai-kit): checkpoint sdk v6 migration`

**Depends on:** Task 2.

## Task 4 — Migrate the green v6 checkpoint to v7

**SPEC:** Acceptance Criteria 1-8

**Route:** `capability=code_write`, `role=active-orchestrator`, `lane=main`, `model=current-session`, `concurrency=serial`, `isolation=current-worktree`, `permission_profile=workspace`, `evidence=v7-build-and-golden`

**Files:** modify the same AI SDK manifests, lockfile, gateway, embedding, provider, registry, mock, and test files touched by the v6 compiler and codemod.

1. Change `ai` to `^7`; move every provider from its accepted v6 checkpoint to its v7 family: Bedrock `^5`, Anthropic `^4`, Azure `^4`, Google `^4`, OpenAI `^4`, OpenAI-compatible `^3`, and provider `^4`. Align the reference app's provider range to `^4`, run `bun install`, and capture the focused build failure before product edits.
2. Preview `bunx @ai-sdk/codemod v7 --dry`, assert the path allowlist, then run `bunx @ai-sdk/codemod v7`. Never run the all-version codemod.
3. Replace `StreamTextResult.fullStream` with `StreamTextResult.stream`. Continue reading terminal `finish.totalUsage` so streaming settles the all-step provider total.
4. Keep non-streaming settlement on `result.usage`, which is the v7 all-step total. Do not switch the money path to `finalStep.usage`.
5. Complete the v7 usage adapter for `inputTokenDetails.cacheReadTokens`; ignore reasoning-token details for pricing unless an existing price-book field explicitly consumes them.
6. Apply the v7 Google provider rename from `createGoogleGenerativeAI` to `createGoogle` and verify the factory's transport and timeout injection are unchanged.
7. Keep trusted server-authored system messages working without enabling `allowSystemInMessages` for user-controlled raw messages. If the SDK rejects current system-message arrays, split trusted system content into `instructions` and preserve the public Caisson input contract.
8. Preserve ESM, Node 22-or-newer compatibility, abort propagation, fetch deadlines, BYOK routing, provider cache behavior, and exactly-once reconciliation.
9. Re-run the golden and all targeted suites without `BLESS`. Any golden or eval delta is a hard stop.

**Verify:**

```bash
bun run --filter @caisson/ai-kit build
bun run --filter @caisson/ai-kit lint
bun run --filter @caisson/ai-kit test
bun run --filter @caisson/ai-kit-app build
bun run --filter @caisson/ai-kit-app test
bun run gate
git diff --check
```

Expected: all commands exit 0; installed core is v7; one compatible provider contract is resolved; the usage golden remains byte-identical.

**Commit:** `refactor(ai-kit): complete sdk v7 migration`

**Depends on:** Task 3.

## Task 5 — Prove every provider and adjacent seam

**SPEC:** Acceptance Criteria 2, 7-8

**Route:** `capability=test_write`, `role=active-orchestrator`, `lane=main`, `model=current-session`, `concurrency=serial`, `isolation=current-worktree`, `permission_profile=workspace`, `evidence=provider-matrix-tests`

**Files:** modify `packages/ai-kit/src/{providers,byok-resolver,gateway,embed}.test.ts`, `packages/ai-kit/live/{gateway,embed}.live.test.ts`, and only compile-proven adjacent files in `packages/ai-config`, `apps/ai-kit`, `packages/local-ai`, or `services/intel`.

1. Add or update a table-driven provider golden for OpenAI, Anthropic, Google, Bedrock, Azure, and the OpenAI-compatible lane group. Assert provider and model identifiers, chat-versus-responses behavior, required base URLs, and missing-key failures.
2. Prove every live factory receives the injected `fetchWithTimeout` wrapper and that abort signals still settle or refund reservations.
3. Prove environment-key and tenant-BYOK registry resolution against the v7 provider contract, including tenant cache isolation.
4. Run the import inventory. Treat `packages/local-ai` and `services/intel` as verification-only unless compiler or eval evidence requires a source change; do not import the SDK there merely to match the Linear sketch.
5. Run live tests only when their required provider credentials are present; absence is reported, not synthesized as a pass. No real credit or buyer mutation is allowed.

**Verify:**

```bash
bun test packages/ai-kit/src/providers.test.ts packages/ai-kit/src/byok-resolver.test.ts packages/ai-kit/src/gateway.test.ts packages/ai-kit/src/embed.test.ts
rg -n -e '@ai-sdk/' -e 'from "ai"' -e "from 'ai'" packages apps services --glob '!packages/cli/templates/**'
bun run --filter @caisson/ai-config build
bun run --filter @caisson/local-ai build
bun run --filter @caisson/service-intel build
bun run gate
```

Expected: focused tests and builds exit 0; imports remain on the accepted boundary; no new adjacent dependency exists.

**Commit:** `test(ai-kit): prove sdk v7 provider matrix`

**Depends on:** Task 4.

## Task 6 — Run the mandatory eval and add release metadata

**SPEC:** Acceptance Criteria 6, 9-10

**Route:** `capability=eval`, `role=active-orchestrator`, `lane=main`, `model=current-session`, `concurrency=serial`, `isolation=current-worktree`, `permission_profile=workspace`, `evidence=eval-baseline-and-changeset`

**Files:** add `.changeset/ai-sdk-v7-migration.md`; update `packages/ai-kit/{README.md,AGENTS.md,CHANGELOG.md,package.json}` and `apps/ai-kit/README.md`; add other package names to the changeset only if their `packages/*` files actually changed.

1. Run `bun run eval` with the committed ADR-0062 baselines. Do not set `BLESS` or modify any baseline. A score, case, or judge-output delta stops execution for operator review.
2. Replace v5 descriptions and mock/type references with v7 language. Document the two-hop checkpoint in the changelog without exposing internal issue language in buyer-facing prose.
3. Add one naming changeset. Minimum expected entry:

```markdown
---
"@caisson/ai-kit": patch
---

Migrate the metered inference and embedding gateway to AI SDK v7 while preserving provider routing and integer usage reconciliation.
```

4. Add each actually changed publishable `packages/*` workspace to the same changeset with the correct release level; never add private apps or untouched packages.
5. Run the standards gate to prove dependency boundaries, prose rules, and changeset presence.

**Verify:**

```bash
bun run eval
bunx changeset status
bun run gate
git diff --check
```

Expected: eval exits 0 with no baseline diff; changeset status names every changed publishable package; gate and diff check exit 0.

**Commit:** `docs(ai-kit): record sdk v7 migration`

**Depends on:** Task 5.

## Task 7 — Verify goal-backward and sweep downstream surfaces

**SPEC:** all acceptance criteria

**Route:** `capability=code_write`, `role=active-orchestrator`, `lane=main`, `model=current-session`, `concurrency=serial`, `isolation=current-worktree`, `permission_profile=workspace`, `evidence=verify-and-sweep-notes`

**Files:** add the phase's `VERIFY.md` and `SWEEP.md` beside the accepted planning artifacts; update only source-of-truth files proven stale by the diff.

1. Re-read the accepted SPEC and answer every criterion from the diff, golden, ledger assertions, eval output, and provider tests.
2. Confirm the v6 checkpoint commit is independently green in history and that v7 was not applied in the same unreviewed hop.
3. Sweep package descriptions, docs, provider inventory, standards-gate allowlists, build state, generated API declarations, and Renovate grouping for stale v5/v6 references.
4. Confirm no `packages/cli/templates/**`, webhook envelope schema, eval baseline, pricing row, or Zod version changed.
5. If VERIFY is partial or failed, open a new plan cycle and do not review or publish.

**Verify:**

```bash
bun run check
bun run eval
bun run sot
git diff --check
git status --short
```

Expected: check, eval, source-of-truth, and diff checks exit 0; status contains only the accepted migration surface and phase artifacts.

**Commit:** `docs(state): verify sdk v7 migration`

**Depends on:** Task 6.

## Task 8 — Run the SHIP audit lane and open the migration PR

**SPEC:** all acceptance criteria; `ai` and `billing` tags

**Route:** read-only dispatches in parallel, then active-orchestrator remediation and publish.

**Review dispatches:**

- `capability=code_review`, `role=gw-code-reviewer`, `lane=deep`, `model=gpt-5.6-sol`, `concurrency=asynchronous`, `isolation=shared-read`, `permission_profile=repo-read`, `evidence=review-report`.
- `capability=security_audit`, `role=gw-security-auditor`, `lane=deep`, `model=gpt-5.6-sol`, `concurrency=asynchronous`, `isolation=shared-read`, `permission_profile=repo-read`, `evidence=review-report`, focused on usage normalization, reserve/reconcile, BYOK, abort/refund, and ledger idempotency.
- PAL `codereview` for the independent advisory lane required by the review workflow.

1. Dispatch the two governed review lanes with the explicit models above and run PAL in the same review wave.
2. Treat code-review Required findings and security HIGH/CRITICAL findings as blockers. Verify each finding against source and tests, fix valid findings, and rerun affected verification plus the review lane.
3. Run the final gates fresh after the last review fix.
4. Push the execution branch and open one draft PR. Link CAISSON-106 and move it to In Review; do not merge, deploy, publish, or consume changesets.

**Verify:**

```bash
bun run check
bun run eval
bun run sot
git diff --check
git status --short --branch
```

Expected: every gate exits 0; review reports have no blocking finding; the worktree is clean after the final commit; one draft PR targets `main`.

**Commit:** review fixes use the narrow conventional scope justified by each finding.

**Depends on:** Task 7.

## Operator Lock Checklist

Before changing either document to `status: accepted`, the operator must lock all four statements:

1. The seven provider packages are the seven direct dependencies in `packages/ai-kit/package.json`, not the stale Linear list.
2. `provider-utils` stays transitive and `react` stays absent unless execution proves a direct import is necessary.
3. Any golden-money or eval-baseline movement stops for a separate decision; the migration cannot bless its own regression.
4. The migration executes later from clean main on its own branch and PR; this planning/debt PR contains no AI SDK migration product code.

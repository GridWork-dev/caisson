# Caisson consolidation audit — 2026-08

**Base:** `audit/consolidation-2026-08` at `45707a1a`  
**Mode:** audit only; no product, registry, dependency, or deployment changes  
**Primary brief:** `outputs/kickoffs/KICKOFF-caisson-consolidation-audit.md`

## Verdict

The sweep admitted **18 verified reductions/ownership folds** totaling an estimated
**1,634–1,711 net lines**, plus **6 decision-gated, next-major, or high-risk candidates** worth
another estimated **1,071–1,131 lines** if the operator elects them.

No LLM adapter deletion survived refutation. No currently sold package is proposed for deletion.
The only whole-package retirement in the picker is the Apache-2.0 `@caisson/analytics` package;
that row is decision-gated because it is published and external usage is unknown.

The ranked choices are in [PICKER-TABLE.md](PICKER-TABLE.md). Each row links to a card under
[`evidence/`](evidence/README.md).

## Method

1. Verified counts and current topology from disk before using state docs.
2. Ran nine read-only first-pass sweeps over adapters, agent packages, prior residuals, tooling,
   package families, apps, registry, services, and CI.
3. Installed the frozen Bun dependency graph, then ran `bun run knip --no-exit-code`.
4. Sent every proposed DELETE/FOLD class through an independent refute pass. A row entered the
   picker only when the refuter preserved a safe shape or explicitly downgraded it with the
   required decision/release guard.
5. Checked registry ledger/index/tarball and bundle status for every package-facing row. The
   registry ledger remains append-only; this audit writes no registry files.
6. Reconciled every candidate against checked-in ADR-0397–0402 evidence and the kickoff hard-don'ts.
   Freshly executed cuts and explicit keeps are not re-proposed. Unavailable workflow/PR-only
   residuals are declared as not swept rather than inferred.

## Disk-truth corrections

| Brief shorthand             | Disk truth                                                                                                        | Evidence                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| “8 adapters”                | 8 `ai-kit` switch groups, 11 public provider identities, and 14 concrete adapter/backend units plus one decorator | `packages/ai-config/src/config.ts:24-37`; `packages/ai-kit/src/providers.ts:107-202` |
| “agent-* family now 5”      | 4 literal `packages/agent-*` workspaces plus the catalog-only `packages/agentic-dev` bundle                       | `packages/`; `packages/agentic-dev/manifest.ts:1-30`                                 |
| “tooling/ surface — 8 dirs” | 9 directories: 8 workspace packages plus loose `tooling/scripts/`                                                 | `package.json:6-16`; `docs/state/package-catalog.md:124-132`                         |

## Coverage

| Domain                | Coverage                                                           | Result                                                         |
| --------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| LLM/provider adapters | `packages/ai-*`, `local-inference`, local-store cloud embedder     | 0 DELETE/FOLD rows; [unit matrix](evidence/TARGET-ADAPTERS.md) |
| Agent family          | 4 `agent-*` packages plus `agentic-dev` bundle                     | 0 picker rows; [package matrix](evidence/TARGET-AGENTS.md)     |
| Package families      | Base, money, platform, compliance, provenance, local-first, AI, UI | 9 picker rows; all package IDs retained                        |
| Apps                  | `apps/site`, `apps/admin`, `apps/demos`                            | 3 picker rows; no route or deploy-unit deletion                |
| Tooling and CI        | 9 tooling directories, root scripts/config, 17 workflows           | 7 picker rows; [tooling matrix](evidence/TARGET-TOOLING.md)    |
| Registry/services     | registry, license, intel, Better Stack adapter                     | 8 picker rows; no ledger/index mutation                        |
| Python seller plane   | docs-RAG and support-bot                                           | **Not swept**, per kickoff exclusion                           |

## Refuted and excluded keeps

These do not appear in the picker:

- **LLM adapters — KEEP.** The `ai-kit` provider groups are public, documented, and tested at
  `packages/ai-kit/src/providers.ts:107-202` and `packages/ai-kit/src/providers.test.ts:59-203`;
  `packages/ai-kit` is also explicitly out of scope. Local-inference transports are public in a
  live $249 package (`packages/local-inference/manifest.ts:6-15`).
- **`agent-dev` — KEEP pending a separate architecture decision.** It owns the sole multi-harness
  emitter, and checked-in state explicitly preserved it (`docs/state/package-catalog.md:117`).
  Re-proposing its fold would violate this kickoff's no-reproposal rule.
- **Public kernel gate — KEEP.** `caisson-gate` is a shipped public bin
  (`packages/kernel/package.json:48-50`) retained by ADR-0111.
- **Registry schema shims — KEEP.** Despite current zero importers, ADR-0097 locks thin
  `registry/schema/*` compatibility shims.
- **Registry Worker `env.REGISTRY_INDEX` seam — KEEP.** It is unused by the current deployment,
  but `outputs/archive/specs/deferred-respec/SPEC-registry-npm-delivery.md:525-526` retains the
  contract.
- **Field-crypto generic KV store — KEEP-frozen.** It is a distinct public extension seam in a
  paid package (`packages/field-crypto/src/kms.ts:169-274`).
- **Compliance/OSCAL evidence schemas — KEEP.** Refutation found an intentional anti-corruption
  boundary: readonly OSCAL projection versus mutable canonical evidence generation.
- **Demo preview manifest, `/demo`, upgrade quote, excerpt rollback flag, and Drizzle seam — KEEP.**
  Each was an explicit prior keep or has a live ADR contract; this audit did not reopen them.
- **ADR-0400 demos transition cleanup — excluded.** Removing the completed arm variable is
  plausible maintenance, but the split and its transition mechanics were executed in the fresh
  ADR-0397–0402 wave and cannot enter this picker.
- **Python seller-plane findings — excluded.** No support-bot or docs-RAG candidate was admitted.

## Prior-audit residuals

The complete 2026-08-09 workflow ledger (`wf_67a45080-ead`) and PR #412 body were not available
from this worktree. Their absent “Skipped” sections are not reconstructed from inference, so that
residual-only source is **not swept**. The checked-in residual and explicit-keep matrix is recorded
in [evidence/PRIOR-RESIDUALS.md](evidence/PRIOR-RESIDUALS.md).

One checked-in residual is independently provable: PR #412 reverted fail-closed declaration-drift
semantics pending an emit-capable dependency-built harness (`docs/state/outstanding-work.md:263`).
That work now exists on the separate `fix/queued-eng-close` branch in commit `6a0b7720` and is
therefore **QUEUE/IN-FLIGHT**, not a new consolidation candidate. This report does not copy or merge
it.

The other checked-in prior exception is `agent-dev`; it remains an explicit KEEP and is excluded
from the picker.

## Adjacent correctness gaps

These are not consolidation choices, but they affect follow-on verification:

- Dependency-cruiser classifies only a subset of current package roots; dynamic/transitive
  direction can false-green for omitted packages (`.dependency-cruiser.cjs:22-35`). C24 reduces
  the policy-copy cause, but a dedicated taxonomy completeness test is still required.
- `tooling/scripts/` has six large test files not run by CI; only the DTS drift and tsgo agreement
  suites are explicitly invoked (`.github/workflows/tsc-native-dts-drift.yml:46-47`).
- SOT source counts ignore `.tsx` and `.test.tsx` (`tooling/scripts/sot-check.ts:1354-1389`).
- Demo registry claims full coverage but is missing six Base and three UI Pro entries; current
  tests use threshold/stale-count assertions (`tooling/demo-registry/src/registry.test.ts:13-17`).
- Current CLI/help/manifest prose still claims dissolved edition aliases work although the runtime
  vocabulary rejects them (`packages/registry-schema/src/bundle-vocabulary.ts:49-63`). This is a
  truth cleanup, not a consolidation cut.
- The visual harness omits current public routes while claiming all-page coverage
  (`apps/site/scripts/visual-harness.ts:110-186`); C25 narrows the duplicate inventory.

## Knip evidence

`bun run knip --no-exit-code` completed after `bun install --frozen-lockfile` and reported:

- 156 unused files
- 5 unused dependencies
- 31 unused devDependencies
- 81 unused exports
- 118 unused exported types

The raw totals are not treated as cuts. Manifests, generated templates, CLI entrypoints, fixtures,
and package entrypoints are known Knip blind spots. The audit admitted only findings confirmed by
caller search plus a refute pass. See [evidence/KNIP.md](evidence/KNIP.md).

## Coverage gaps

- No external buyer-import/download telemetry. Published public API removals are downgraded or
  next-major only.
- No provider-console state beyond checked-in deployment receipts.
- No live GitHub PR body for #412 and no available `wf_67a45080-ead` projection.
- No project-local `graphify-out/graph.json`; exact import/reference search, package manifests,
  dependency-cruiser, Knip, tests, and git history were used instead.
- The audit branch intentionally remains at kickoff base `45707a1a`; newer `main` work was not
  merged into this report lane.
- Python seller plane was not swept by design.

## Verification

- `bun run knip --no-exit-code` — completed; adjudicated counts recorded above.
- `bunx prettier --check "outputs/audit/2026-08-consolidation/**/*.md"` — green.
- Local Markdown links, candidate/card parity, arithmetic, and concrete repo-relative citation paths
  — green under read-only Bun checks.
- `git diff --check` — green.
- `bun run sot` — all content checks green: ADR ceiling, frontmatter freshness, archive integrity,
  tracker reality, changeset preflight, package-count parity, and docs surface. The command exits 1
  only on pre-existing branch hygiene: active `fix/dep-wave-2026-08-11`,
  `fix/queued-eng-close`, and `fix/site-message-match` branches/worktrees. This audit lane does not
  delete or mutate concurrent worktrees.

## Audit-only proof

The only files authored by this lane are under `outputs/audit/2026-08-consolidation/`. The kickoff
file remains untracked and outside the report commit. No cut, dependency edit, ledger append,
changeset, or deployment was performed.

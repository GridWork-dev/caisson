# ADR-0413 — Execute C13 (browser-audit fold) and C25 (visual-harness route derivation)

- **Date:** 2026-08-19
- **Status:** Accepted (operator lock at the session picker, 2026-08-19 — "Take both now")
- **Parent:** ADR-0407 (the consolidation picker; parked these two as `CONDITIONAL`) · ADR-0322
  (the production browser audit the folded reconciler serves) · ADR-0328 D6 (parallel worktree waves)
- **Disposes:** the C13 and C25 rows of `outputs/audit/2026-08-consolidation/PICKER-TABLE.md`
  (rows 22 and 24). Four of the six decision-gated rows are now closed; **C10 and C16 stay parked.**

## Context

ADR-0407 executed 18 verified consolidation cuts and parked six rows behind a fresh operator
decision each: _"Re-proposing any deferred row re-enters through a fresh operator decision, not this
ADR."_ C01 came back as ADR-0410, C04 as ADR-0411. This is the third re-entry, and it takes two rows
at once because they are tree-disjoint and both are `CONDITIONAL` rather than `HIGH-RISK` — the
condition, in each case, is a specific thing the patch must not do.

## Decision

### C13 — `tooling/browser-audit` folds into its only consumer

A 39-line status adapter over the shared reconciler in `tooling/testing`, with exactly one
production caller: the `caisson-production-browser-audit` skill next door. The package is deleted
and `reconcile.ts` + `reconcile.test.ts` move into that skill's `scripts/` directory, byte-identical
(git records both as 100%-similarity renames).

**The card's condition — "a deletion-only patch is invalid" — is met, and it is the whole substance
of the row.** `.agents/` sits outside the root Bun workspaces, so the skill's scripts have no turbo
task and a straight delete would have silently dropped required coverage. `ci.yml`'s `check` job —
required, unconditional on every non-draft PR — now also runs the skill's scripts directory.

The leading `./` on that path is load-bearing: `bun test .agents/…` without it reports _"filters did
not match any test files"_ and exits 1, because bun's discovery skips dot-directories and reads a
bare path as a name filter. It fails loud rather than green, so no silently-zero-test state exists —
but the prefix is what makes it actually run the 24 tests.

**Typecheck is restored too, and it was NOT covered by the first patch.** The deleted
`tooling/browser-audit/package.json`'s `build: tscn -p tsconfig.json` was the only thing typechecking
this code; the root `tsconfig.json` is `"files": []`, `.agents/` has no tsconfig, and turbo cannot
reach outside the workspaces. Lint and format both survived the move (`lint:repo` and `oxfmt` walk
`.agents` — measured, 1892 files vs 1880 without it), but `tsc` did not. Since `reconcile.ts`
re-exports a type from the shared reconciler and calls a generic, a signature or union change
upstream would have produced no build error anywhere. The skill gets its own tsconfig and a `tscn`
leg on the same required step. The card said "build/lint/test home"; all three are now answered.

### C25 — the visual harness derives its public routes

`apps/site/scripts/visual-harness.ts` hand-maintained route arrays that had gone stale on five
public routes. Public marketing/legal/writing paths now derive from `lib/routes.ts` and
`WRITING_PIECES` — the same registries `app/sitemap.ts` reads, so the sitemap and the harness cannot
disagree about what is public (`LEGAL_ROUTES` and `MARKETPLACE_TAB_ROUTES` are themselves filters
over `MARKETING_ROUTES`, so the union is exactly that set by construction, not by coincidence).

**The card's refutation is binding and is honoured:** total derivation was refused. `/cart`, the auth
routes and the dashboard routes stay explicit, because they need setup no registry describes. The
marketing-vs-marketplace split is a membership test over `MARKETPLACE_TAB_ROUTES`, not a second
route list, so a new registry row is shot whether or not anyone remembers to name it.

Measured delta: five routes added (`/writing`, `/trust`, `/support`,
`/frameworks/eu-ai-act/article-50`, and the published writing spoke), **none removed**, 177 routes
with no duplicates. Exactly the set the card named.

## Consequences

- **A second dead test surfaced and is now live.** `apps/site`'s test script was
  `bun test ./lib ./emails ./components ./app` — `./scripts` was absent, so the pre-existing
  `visual-harness.test.ts` ran nowhere: not under turbo, not in CI. It was unwired, not broken; its
  assertions pass unchanged and are now a strict subset of the new ones. Two dead-coverage findings
  from one row is the pattern worth noting — **a directory outside the workspace globs is invisible
  to every gate that enumerates workspaces**, and this repo has three such directories
  (`.agents/`, `scripts/`, `tooling/scripts/`).
- Counts restamped from disk, not assumed: tooling workspaces 7 → 6, Bun workspaces 73 → 72, turbo
  tasks 202 → 199, standards-gate 68 → 67, across `build-state`, `package-catalog` (×3),
  `architecture` (×2), `public-surface`, `production-readiness`.
- `reconcile.ts` imports the shared reconciler by relative path rather than `@caisson/testing`,
  because `.agents/` is outside the workspaces so bun does not link the dep there, and the barrel
  would drag PGlite/jsdom/axe-core in for a 47-line pure function. It reaches past
  `tooling/testing`'s `exports` map, which nothing enforces here — `.agents` never enters the OSS
  mirror (`export-public-mirror.ts` scans `packages/*` + `tooling/*` only) and dependency-cruiser's
  rules anchor to `packages/`. A `"./reconcile"` export subpath would be the cleaner seam; noted,
  not taken, because it changes a published package's surface for an internal skill's benefit.
- **C10 and C16 remain parked** and still require their own fresh decision. C10 is blocked on a
  `field-crypto` major; C16 is `HIGH-RISK`.

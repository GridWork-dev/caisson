# KICKOFF — Audit remediation Lane A: deletions + mechanical sweep

- **Worktree:** `/home/gw/lab/caisson-wt-lane-a` · **Branch:** `fix/audit-deletions-sweep` (cut from main)
- **One PR, hard.** Push the branch and OPEN the PR; never merge it — the reconcile session merges (ADR-0328).
- **Decisions already locked:** ADR-0397 (deletions) + ADR-0401 §4 (mechanical cuts) in `knowledge/decisions/`. Do not edit ADRs, `docs/adr-index.md`, or `docs/state/decisions-and-forks.md` — boards are frozen during the wave.
- **Evidence basis:** every item below was adversarially verified against this tree on 2026-08-09 (0 refuted). If an item resists — you find a live reference the audit missed — SKIP it and list it under "Skipped" in the PR description. Never force a cut.

## Part 1 — headline deletions (ADR-0397), in this order

1. **Relocate `apps/base`'s four integration tests before anything is deleted** (atomic commit #1):
   - `apps/base/src/generate.integration.test.ts` — proves the buyer-MCP generate path (debit-before-spend ADR-0007, idempotent dedup ADR-0024, audit row) over PGlite → move to `packages/mcp-server` (the seam it proves; it imports `@caisson/testing` newTestPg + tenancy-rls + credits SQL — keep all assertions byte-equivalent, only the location and any relative imports change).
   - `apps/base/src/app.integration.test.ts`, `rate-limit-default.test.ts`, `server-validation.test.ts` → read each; move to the package whose seam each proves (likely `packages/kernel` / `packages/rate-limit` / `packages/mcp-server`). Tests move, never die. PGlite tests need the repo-standard `setDefaultTimeout(30_000)` and may need `--concurrency=1` locally under load (known flake class — confirm red twice before blaming the move).
2. **Delete** `apps/base`, `apps/ai-kit`, `apps/agent-dev`, `apps/local-ai`, `apps/compliance`, `packages/agent-dev`, `packages/local-ai` (commit #2). Notes:
   - `packages/ai-kit` STAYS — `apps/site/lib/byok.ts` + `lib/site-migrations.ts` import it.
   - Registry ledger/sidecar files (`registry/ledger.jsonl`, `registry/tarballs.json`) are APPEND-ONLY — touch nothing there. Source deletion only; the packages were delisted 2026-07-07.
   - `tooling/standards-gate/src/checks.ts` — remove `apps/base` from `isProseScanTarget`; grep the gate + `tooling/` for any other enumeration of the deleted dirs.
   - `packages/cli/src/meter.ts:47` prose references "apps/base's composition root" — repoint the comment at `packages/cli/templates/base` (the tree buyers actually get).
   - Grep `.changeset/`, `turbo.json`, `knip.json`, root `package.json` workspaces, `bun.lock` (run `bun install` after deletion to reconcile the lockfile).

## Part 2 — dead code (one commit per coherent group is fine)

- `apps/admin/src/app/catalog/signature/` — whole directory (3 files, 523 LOC). `catalog-nav.tsx` comment marks it deliberately unlinked; zero references outside the dir.
- `registry/scripts/backfill.ts` + `backfill.test.ts` (462) — self-documented dead ("nothing wires it into CI", line ~37).
- `tooling/scripts/tsgo-agreement.ts` — DELETE the CLI mode (main() at ~line 349, parseArgv, runCompiler, diffDiagnostics, formatCompilerCell, agreementLabel, formatRow, runDtsDiffKernel). KEEP `discoverTscPackages`, `compareDtsTrees`, and the `DtsTreeDiff` type — `tooling/scripts/dts-drift-check.ts:15-16` imports exactly those; move them into a leaner module (or slim the same file) and keep `tsc-native-dts-drift.yml` green.
- `packages/cli/src/generate.ts:68-121` — `defaultEngine` + `readme()`. Rewrite the two consuming tests (`packages/cli/src/generate.test.ts`; the apps/base integration test you relocated in Part 1 — `generate.integration.test.ts` imports it too) to construct a minimal inline spy `GeneratorEngine` instead. Remove the re-export from `index.ts`.
- `tooling/browser-audit/src/reconcile.ts` — `stageCandidateTest` + `CandidateTest` interface (zero callers outside its own test).
- `packages/demo-registry/src/registry.ts:43-55` — `entriesByPackage`, `getCatalogEntry` + their index.ts re-exports (zero external callers; `entriesByTier`/`listPackages` stay).
- `apps/site/public/demo-preview/{transcript-build,transcript-install,transcript-test,walkthrough}.json` — delete all four AND stop `tools/demo-preview/generate.ts` (~lines 219-231) writing them; update `tools/demo-preview/artifacts.test.ts` accordingly. `preview.json` + `manifest.json` stay (live readers).
- `packages/license-issue/src/signer.ts:~176` — `KmsSigner` interface (zero implementations; delete + its `index.ts:13` type re-export; the glossary prose sentence in `apps/site/lib/glossary.ts` stays — it's copy, Lane B owns copy).
- `packages/pricebook/src/conversion.ts` — pure re-export file; delete, repoint `pricebook`'s own index/test imports at `@caisson/kernel` directly.

## Part 3 — dependency hygiene

- `packages/jobs/package.json` — drop `ioredis` (never imported; connection is caller-injected).
- `packages/cli/package.json` — drop devDeps `@caisson/ai-config`, `@caisson/auth`, `@caisson/billing`, `@caisson/email`, `next` (knip-confirmed unused, lines ~50-65).
- Drop the `@caisson/testing` devDependency from the 23 workspaces that never import it — verify each with `bun run knip` (the knip `--dependencies` list is the source of truth; three of the 23 are apps you deleted in Part 1).
- `packages/signing-primitive/package.json` — drop the `@caisson/compliance-core` devDep; `src/sign.test.ts:23` builds its manifest-shaped fixture inline instead (`portable.ts` documents the shape as structural).

## Part 4 — CI + duplication hygiene

- **Composite action:** create `.github/actions/setup-bun/action.yml` wrapping the byte-identical checkout + `oven-sh/setup-bun` (bun 1.3.14, same pinned SHAs currently used) + the "cache bun install" block; replace the trio in every job that carries all three verbatim (33/27/16 copies across the 17 workflows). Keep the pinned SHAs EXACTLY as they are today. Jobs with variant cache blocks (turbo cache, version-pr's second cache) keep those extra steps.
- `regulatory-claim-watch.yml` — rewrite to `nist-catalog-watch.yml`'s plain 8-step shape (drop the 3× continue-on-error bootstrap dance + triplicated fallback text; job stays report-only, always green).
- `quality.yml` ~224-233 — delete the stale 2026-07-30 "GitHub-hosted macos-15" comment block (the 2026-08-01 Blacksmith block below it is current). `lighthouse.yml:29` — fix the "STAYS GitHub-hosted" comment to match its real Blacksmith runs-on.
- `lighthouse.yml` — add the standard `concurrency:` group (only workflow of 17 without one).
- Advisory `retention-days: 30` on the report uploads in `nist-catalog-watch.yml`, `regulatory-claim-watch.yml`, `tsc-native-dts-drift.yml` (matches pgrls-advisory/security-scan).
- `.githooks/pre-commit:24` — comment claims "eslint + tsc"; only tsc runs. Fix the comment (do NOT add eslint to the hook).
- **Shrinks (extract, don't redesign):**
  - One shared reconcile helper for `tooling/browser-audit/src/reconcile.ts:15-46` + `tooling/design-critic/src/findings.ts:84-119` (same algorithm, different status vocab — generic over the terminal-status name). Home: `tooling/testing` or a tiny shared module; both packages import it.
  - One shared `proxyGet` for `apps/admin/src/lib/loki.ts:206-227` + `grafana.ts:159-181` (byte-identical bodies).
  - One `activeEntitlementIds(db, accountId)` helper for the byte-identical grant-read block in `apps/site/lib/{compliance-gate,ai-production-gate,members-gate}.ts`.
  - One shared `shortHash`/`eventName` (they diverge 4-vs-6 hex chars today): export from `apps/site/lib/audit-chain-sample.ts`, import in `components/poke/audit-worm-poke.tsx` (pick the lib version's behavior).
  - One `licenseServiceProxy(path, body, {timeoutMs})` for `apps/admin/src/lib/admin-mutations-runtime.ts:63-137`'s twin functions.
  - `apps/site/lib/writing.ts` + `lib/glossary.ts` → rename to `.tsx`, replace the 24 raw `React.createElement` calls with JSX (rendered output byte-identical — `writing.test.ts` renderToStaticMarkup assertions must stay green unchanged).
  - Delete `packages/ui/turbo.json` + `packages/ui-pro/turbo.json` — CAVEAT: their `build.outputs` is `["dist/**"]`, NARROWER than root's; after deletion both inherit root's wider outputs list. Verify `bunx turbo run build --filter=@caisson/ui --dry-run` shows sane outputs and the build stays cached correctly; if anything is off, keep the files and note it.

## Gates before opening the PR

```bash
cd /home/gw/lab/caisson-wt-lane-a
bun install                      # reconcile lockfile after deletions
bun run check                    # turbo build+lint+typecheck+test + kernel gate — must be green
bun run knip                     # advisory: confirm the dep cuts landed, no new findings
bun run sot                      # advisory: fix what it flags EXCEPT board/ADR files (frozen)
bunx changeset status --since=origin/main   # see changeset note below
```

**Changesets:** any changed `packages/*` needs a naming changeset (the gate covers private packages; prose = plain buyer-facing sentences, NEVER cite ADR numbers in changeset prose). Dep-only removals = patch. One changeset file may name many packages. Deleted packages need no changeset (they no longer exist) — but remove any pending `.changeset/*.md` that names ONLY deleted packages; if a pending changeset names a deleted package alongside live ones, edit the deleted name out.

**Commit style:** conventional commits, plain-ASCII subjects, one logical change each. PR title `fix(scaffold): audit wave lane A — deletions + mechanical sweep (ADR-0397/0401)`. PR body: summary, itemized cuts, "Skipped" list with reasons, net LOC.

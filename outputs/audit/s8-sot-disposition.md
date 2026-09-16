# S8 SOT disposition — 2026-09-10

## R378 current disposition — 2026-09-16

The authorized build-state correction c9250e86 reconciles ADR-0427 and the two
measured count rows. The single SOT rerun returns GREEN for ADR and package parity
and every other check except the two accepted EXPECTED-DRIFT classes: frontmatter
freshness and branch hygiene. Exact sixteen-document/source-date evidence is in
[s8-r378-sot.log](s8-r378-sot.log). No dates, branches or other worktrees changed.
R378 allows green-PR preparation; aggregate release readiness still requires SOT exit 0.

The operator resolved the prior SOT stop and directed continuation. This is a scoped disposition, not a claim that the unmodified aggregate SOT command is green.

| Check                 | Disposition                                                                                                                                                                                                                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch hygiene        | **EXPECTED-DRIFT**: the brief and repeated operator rulings require preserving all three R212 branches. That instruction wins over the advisory deletion check.                                                                                                                                                                                      |
| Docs surface          | **PASS**, exit 0: repository `checkDocsSurface` reports root/state allowlists and AGENTS symlink intact. Root `RUN-NOTES.md` moved to `outputs/audit/release-train-2026-09-RUN-NOTES.md`; current receipt reference updated. Historical command transcripts retain their historical paths.                                                           |
| Changeset preflight   | **PASS**, exit 0 using `bunx @changesets/cli status --since=origin/main` through `snip proxy bash -c`. CLI reported v3.0.2 and an empty “Packages to be bumped” list. No repository lockfile change. The root manifest declares `@changesets/cli` but no dedicated status script. This branch comparison does not count the pending release backlog. |
| Frontmatter freshness | **REPORTED; dates unchanged**, per operator ruling. Exact stale documents and source dates below.                                                                                                                                                                                                                                                    |

## Freshness evidence

Recomputed with the repository's exported `checkDocFreshness` over its exact freshness scope: `docs/state/*.md`, `docs/ops/*.md`, `docs/architecture.md`, `docs/build-state.md`, and `docs/deploy/STATE.md`. Dates came from `git -C <worktree> log -1 --format=%cs -- <path>`. The read-only driver `/tmp/s8-freshness-report.ts` exited 0. All findings below are date lag, not dead pointers.

Every source listed in the last column has last-commit date **2026-09-09**. “Self” means the document's own last commit. Commit-date comparison identifies review candidates; it does not establish that every passage is factually wrong.

| Document                              | Declared `updated` | Newer sources (all 2026-09-09)                                                                                                                                                                                                                           |
| ------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/architecture.md`                | 2026-09-05         | Self; `package.json`; `.github/workflows/ci.yml`; `docs/deploy/STATE.md`                                                                                                                                                                                 |
| `docs/build-state.md`                 | 2026-09-05         | Self                                                                                                                                                                                                                                                     |
| `docs/deploy/STATE.md`                | 2026-09-05         | Self; `docs/build-state.md`; `docs/ops/launch-runbook.md`                                                                                                                                                                                                |
| `docs/ops/db-restore.md`              | 2026-08-28         | `docs/deploy/STATE.md`                                                                                                                                                                                                                                   |
| `docs/ops/launch-runbook.md`          | 2026-09-05         | Self; `docs/state/outstanding-work.md`; `docs/state/production-readiness.md`; `docs/deploy/STATE.md`; `docs/ops/provider-console-checks.md`                                                                                                              |
| `docs/ops/operator-walkthrough.md`    | 2026-09-05         | Self; `docs/state/outstanding-work.md`; `docs/state/decisions-and-forks.md`; `docs/state/production-readiness.md`; `docs/deploy/STATE.md`; `docs/ops/provider-console-checks.md`                                                                         |
| `docs/ops/parallel-session-waves.md`  | 2026-09-05         | Self; `docs/state/decisions-and-forks.md`                                                                                                                                                                                                                |
| `docs/ops/probe-accounts.md`          | 2026-09-05         | Self; `docs/state/outstanding-work.md`; `docs/deploy/STATE.md`                                                                                                                                                                                           |
| `docs/ops/provider-console-checks.md` | 2026-09-05         | Self; `docs/ops/probe-accounts.md`; `docs/ops/operator-walkthrough.md`; `docs/ops/launch-runbook.md`; `docs/state/outstanding-work.md`; `docs/state/production-readiness.md`; `docs/state/decisions-and-forks.md`                                        |
| `docs/ops/release-tag-signing.md`     | 2026-08-19         | `.github/workflows/release-train.yml`                                                                                                                                                                                                                    |
| `docs/state/compatibility-matrix.md`  | 2026-08-25         | `packages/cli/templates/`                                                                                                                                                                                                                                |
| `docs/state/decisions-and-forks.md`   | 2026-09-05         | Self                                                                                                                                                                                                                                                     |
| `docs/state/operator-surface.md`      | 2026-09-05         | Self; `docs/state/production-readiness.md`; `docs/ops/launch-runbook.md`; `docs/ops/operator-walkthrough.md`; `docs/ops/provider-console-checks.md`; `docs/ops/probe-accounts.md`; `docs/state/outstanding-work.md`; `docs/state/decisions-and-forks.md` |
| `docs/state/outstanding-work.md`      | 2026-09-05         | Self; `docs/state/decisions-and-forks.md`; `docs/state/production-readiness.md`; `docs/deploy/STATE.md`; `docs/ops/provider-console-checks.md`                                                                                                           |
| `docs/state/package-catalog.md`       | 2026-09-02         | `package.json`; `packages/`; `apps/`; `tooling/`                                                                                                                                                                                                         |
| `docs/state/production-readiness.md`  | 2026-09-05         | Self; `docs/state/outstanding-work.md`; `docs/ops/launch-runbook.md`; `docs/deploy/STATE.md`; `docs/ops/provider-console-checks.md`                                                                                                                      |

No dates were bumped. Task 1 resumes under the existing prediction and stop rule; application key observation remains outstanding.

Readback confirms all three named branches remain present. `git diff --check` passed before staging.

## R324 fresh readback — 2026-09-14

`bun run sot` exits 1 with the same two disposition classes: frontmatter freshness and branch hygiene. ADR parity, archive integrity, tracker-vs-reality, changeset preflight, package-count parity and docs surface are GREEN. No aggregate-green claim. The same 16 documents lag; no updated dates were bumped. Source-date changes since the earlier table: `docs/state/package-catalog.md` now lags `packages/`, `apps/`, and `services/` dated **2026-09-14** (package catalog updated 2026-09-02); `docs/architecture.md` lags `.github/workflows/ci.yml` dated **2026-09-10** (doc updated 2026-09-05); `docs/ops/release-tag-signing.md` lags `.github/workflows/release-train.yml` dated **2026-09-10** (doc updated 2026-08-19). All other listed source dates remain 2026-09-09.

Branch hygiene remains EXPECTED-DRIFT under branch preservation and the authorized active worktrees. The readback lists eight other local branches: chore/bun-1.4-fleet-2026-09, chore/s8-remove-direct-key-observation, ci/ubicloud-2026-09, docs/sweep-2026-09-01, feature/s8-direct-key-observation, fix/publish-gates-2026-09, fix/session-hint-httponly, probe/fumadocs-16.15. None is deleted. Four other linked worktrees remain.

Explicit corrected CLI `bunx @changesets/cli status --since=origin/main` also exits zero with no patch/minor/major packages on the reconciled lane. This comparison is not a count of the pending release backlog.

## R352 fresh candidate readback — 2026-09-15

Bun 1.4.2, candidate 05081a20091d3a7971609daab94008c8d352688e plus preparation docs. Aggregate sot exits 1 with only the expected two drift classes. ADR parity is 0422; archive, tracker, Changeset preflight, package counts and docs surface all GREEN. Counts are 58 packages, 16 Apache-2.0 / 42 commercial, 72 Bun workspaces. Preflight remains a branch comparison and is not the full-backlog status.

All nine other branches and four other linked worktrees remain preserved; branch-hygiene is EXPECTED-DRIFT under the operator ruling, not a new gate failure. Same sixteen freshness documents; current complete lag-source dates follow. Short source labels below denote the named docs/state or docs/ops file already listed in the earlier exact-path table. No date bump or aggregate readiness waiver.

| Document                              | Declared updated | Newer source dates                                                                                                                                                          |
| ------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/architecture.md`                | 2026-09-05       | Self and docs/deploy/STATE.md: 2026-09-09; package.json and .github/workflows/ci.yml: 2026-09-14                                                                            |
| `docs/build-state.md`                 | 2026-09-05       | Self: 2026-09-14                                                                                                                                                            |
| `docs/deploy/STATE.md`                | 2026-09-05       | Self and docs/ops/launch-runbook.md: 2026-09-09; docs/build-state.md: 2026-09-14                                                                                            |
| `docs/ops/db-restore.md`              | 2026-08-28       | docs/deploy/STATE.md: 2026-09-09; docs/operations.md: 2026-09-14                                                                                                            |
| `docs/ops/launch-runbook.md`          | 2026-09-05       | Self, outstanding-work, production-readiness, deploy STATE and provider-console-checks: 2026-09-09                                                                          |
| `docs/ops/operator-walkthrough.md`    | 2026-09-05       | decisions-and-forks: 2026-09-14; Self, outstanding-work, production-readiness, deploy STATE and provider-console-checks: 2026-09-09                                         |
| `docs/ops/parallel-session-waves.md`  | 2026-09-05       | Self: 2026-09-09; decisions-and-forks: 2026-09-14                                                                                                                           |
| `docs/ops/probe-accounts.md`          | 2026-09-05       | Self, outstanding-work and deploy STATE: 2026-09-09                                                                                                                         |
| `docs/ops/provider-console-checks.md` | 2026-09-05       | decisions-and-forks: 2026-09-14; Self, probe-accounts, operator-walkthrough, launch-runbook, outstanding-work and production-readiness: 2026-09-09                          |
| `docs/ops/release-tag-signing.md`     | 2026-08-19       | .github/workflows/release-train.yml: 2026-09-14                                                                                                                             |
| `docs/state/compatibility-matrix.md`  | 2026-08-25       | packages/cli/templates/: 2026-09-14                                                                                                                                         |
| `docs/state/decisions-and-forks.md`   | 2026-09-05       | Self: 2026-09-14                                                                                                                                                            |
| `docs/state/operator-surface.md`      | 2026-09-05       | decisions-and-forks: 2026-09-14; Self, production-readiness, launch-runbook, operator-walkthrough, provider-console-checks, probe-accounts and outstanding-work: 2026-09-09 |
| `docs/state/outstanding-work.md`      | 2026-09-05       | decisions-and-forks: 2026-09-14; Self, production-readiness, deploy STATE and provider-console-checks: 2026-09-09                                                           |
| `docs/state/package-catalog.md`       | 2026-09-02       | package.json, packages/ and registry/: 2026-09-14; apps/ and services/: 2026-09-15; tooling/: 2026-09-09                                                                    |
| `docs/state/production-readiness.md`  | 2026-09-05       | Self, outstanding-work, launch-runbook, deploy STATE and provider-console-checks: 2026-09-09                                                                                |

## R373 candidate stop — 2026-09-16

Candidate 98a3501d. Aggregate SOT exits 1. Newly unaccepted: ADR ceiling mismatch
(build-state 0422 versus other sources 0427) and package count mismatch
(local-store 12/10/1200 versus 12/10/1201; tool-exec 4/2/308 versus 5/3/509).
Execution stopped before PR. No build-state edit or date bump; all branches preserved.
Branch preservation remains EXPECTED-DRIFT. The following freshness evidence is
the command's exact document/declared-date/source-date output, not a diagnosis that
all prose is stale. Full raw command output: s8-r373-sot.log.

```text
    docs/state/compatibility-matrix.md: grounds "packages/cli/templates/" committed 2026-09-14, doc says updated: 2026-08-25
    docs/state/decisions-and-forks.md: last committed 2026-09-16, but its own updated: says 2026-09-05
    docs/state/operator-surface.md: last committed 2026-09-09, but its own updated: says 2026-09-05
    docs/state/operator-surface.md: grounds "docs/state/production-readiness.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/state/operator-surface.md: grounds "docs/ops/launch-runbook.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/state/operator-surface.md: grounds "docs/ops/operator-walkthrough.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/state/operator-surface.md: grounds "docs/ops/provider-console-checks.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/state/operator-surface.md: grounds "docs/ops/probe-accounts.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/state/operator-surface.md: grounds "docs/state/outstanding-work.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/state/operator-surface.md: grounds "docs/state/decisions-and-forks.md" committed 2026-09-16, doc says updated: 2026-09-05
    docs/state/outstanding-work.md: last committed 2026-09-09, but its own updated: says 2026-09-05
    docs/state/outstanding-work.md: grounds "docs/state/decisions-and-forks.md" committed 2026-09-16, doc says updated: 2026-09-05
    docs/state/outstanding-work.md: grounds "docs/state/production-readiness.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/state/outstanding-work.md: grounds "docs/deploy/STATE.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/state/outstanding-work.md: grounds "docs/ops/provider-console-checks.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/state/package-catalog.md: grounds "package.json" committed 2026-09-14, doc says updated: 2026-09-02
    docs/state/package-catalog.md: grounds "packages/" committed 2026-09-16, doc says updated: 2026-09-02
    docs/state/package-catalog.md: grounds "apps/" committed 2026-09-16, doc says updated: 2026-09-02
    docs/state/package-catalog.md: grounds "services/" committed 2026-09-15, doc says updated: 2026-09-02
    docs/state/package-catalog.md: grounds "registry/" committed 2026-09-14, doc says updated: 2026-09-02
    docs/state/package-catalog.md: grounds "tooling/" committed 2026-09-09, doc says updated: 2026-09-02
    docs/state/production-readiness.md: last committed 2026-09-09, but its own updated: says 2026-09-05
    docs/state/production-readiness.md: grounds "docs/state/outstanding-work.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/state/production-readiness.md: grounds "docs/ops/launch-runbook.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/state/production-readiness.md: grounds "docs/deploy/STATE.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/state/production-readiness.md: grounds "docs/ops/provider-console-checks.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/ops/db-restore.md: grounds "docs/deploy/STATE.md" committed 2026-09-09, doc says updated: 2026-08-28
    docs/ops/db-restore.md: grounds "docs/operations.md" committed 2026-09-14, doc says updated: 2026-08-28
    docs/ops/launch-runbook.md: last committed 2026-09-09, but its own updated: says 2026-09-05
    docs/ops/launch-runbook.md: grounds "docs/state/outstanding-work.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/ops/launch-runbook.md: grounds "docs/state/production-readiness.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/ops/launch-runbook.md: grounds "docs/deploy/STATE.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/ops/launch-runbook.md: grounds "docs/ops/provider-console-checks.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/ops/operator-walkthrough.md: last committed 2026-09-09, but its own updated: says 2026-09-05
    docs/ops/operator-walkthrough.md: grounds "docs/state/outstanding-work.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/ops/operator-walkthrough.md: grounds "docs/state/decisions-and-forks.md" committed 2026-09-16, doc says updated: 2026-09-05
    docs/ops/operator-walkthrough.md: grounds "docs/state/production-readiness.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/ops/operator-walkthrough.md: grounds "docs/deploy/STATE.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/ops/operator-walkthrough.md: grounds "docs/ops/provider-console-checks.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/ops/parallel-session-waves.md: last committed 2026-09-09, but its own updated: says 2026-09-05
    docs/ops/parallel-session-waves.md: grounds "docs/state/decisions-and-forks.md" committed 2026-09-16, doc says updated: 2026-09-05
    docs/ops/probe-accounts.md: last committed 2026-09-09, but its own updated: says 2026-09-05
    docs/ops/probe-accounts.md: grounds "apps/site/lib/auth-server.ts" committed 2026-09-15, doc says updated: 2026-09-05
    docs/ops/probe-accounts.md: grounds "docs/state/outstanding-work.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/ops/probe-accounts.md: grounds "docs/deploy/STATE.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/ops/provider-console-checks.md: last committed 2026-09-09, but its own updated: says 2026-09-05
    docs/ops/provider-console-checks.md: grounds "docs/ops/probe-accounts.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/ops/provider-console-checks.md: grounds "docs/ops/operator-walkthrough.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/ops/provider-console-checks.md: grounds "docs/ops/launch-runbook.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/ops/provider-console-checks.md: grounds "docs/state/outstanding-work.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/ops/provider-console-checks.md: grounds "docs/state/production-readiness.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/ops/provider-console-checks.md: grounds "docs/state/decisions-and-forks.md" committed 2026-09-16, doc says updated: 2026-09-05
    docs/ops/release-tag-signing.md: grounds "scripts/release-readiness.ts" committed 2026-09-16, doc says updated: 2026-08-19
    docs/ops/release-tag-signing.md: grounds ".github/workflows/release-train.yml" committed 2026-09-14, doc says updated: 2026-08-19
    docs/architecture.md: last committed 2026-09-09, but its own updated: says 2026-09-05
    docs/architecture.md: grounds "package.json" committed 2026-09-14, doc says updated: 2026-09-05
    docs/architecture.md: grounds ".github/workflows/ci.yml" committed 2026-09-14, doc says updated: 2026-09-05
    docs/architecture.md: grounds "docs/deploy/STATE.md" committed 2026-09-09, doc says updated: 2026-09-05
    docs/build-state.md: last committed 2026-09-14, but its own updated: says 2026-09-05
    docs/deploy/STATE.md: last committed 2026-09-09, but its own updated: says 2026-09-05
    docs/deploy/STATE.md: grounds "docs/build-state.md" committed 2026-09-14, doc says updated: 2026-09-05
    docs/deploy/STATE.md: grounds "docs/ops/launch-runbook.md" committed 2026-09-09, doc says updated: 2026-09-05
```

# ADR-0358 — Platform-tails wave: sibling-churn version gate, immutable-input deploys, R2 backfill tool, mirror CI

- **Date:** 2026-07-17
- **Status:** Locked (operator, triage picker + merge go, 2026-07-17 PM)
- **Extends:** ADR-0328 (wave convention) · ADR-0325 (release-train provenance) · ADR-0357 (R2 parity guards / sibling-churn) · ADR-0019 (project.toml manifest, F6) · ADR-0094 (open-core mirror)
- **PRs:** #262 (registry churn-gate + R2 backfill tool) · #263 (immutable-input deploys) · #264 (mirror CI + presentation memo)

## Context

The 2026-07-17 PM triage picker selected three platform-tail lanes to run as an ADR-0328
parallel wave (one worktree + one PR each, boards frozen): platform-tails cleanup
(CAISSON-124 + the CAISSON-125 backfill tool), immutable Railway deploys (CAISSON-121, P0),
and caisson-oss CI + marketing prep. Built by three `gw-typescript-pro` builders, then
SHIP-audited in-session (three code reviews + two security audits, adversarially verified);
every lane verdicts SHIP after in-lane fixes. This ADR records the locks the wave shipped
under and the residuals the audits named. All forks other than CAISSON-125 stayed parked per
the operator's Q2.

## Decisions

### D1 — Sibling-churn re-verify runs inside the live version publish step (CAISSON-124)

The sibling-repack-and-compare loop is extracted as `checkSiblingChurn` and called from BOTH
`refreshVersionCandidateTarballs` (the `pull_request_target:[synchronize]` refresh job, ADR-0357
D4) and a new call site in `runPublishStep`'s `mode==="version"` branch. A single-shot
`workflow_dispatch` version PR never fires `synchronize`, so a consume could churn a sibling's
packed bytes at an unchanged version undetected until publish's byte gate failed closed (ride
`v2026.07.17.3`, `@caisson/cli@0.6.2` — the pack-embeds-devDep-versions class). The re-verify
covers only other already-advertised rows; zero behaviour change to the refresh path.

### D2 — Immutable-input Railway deploys with single-use receipts (CAISSON-121); RAILWAY_TOKEN pre-arm requirement

`tooling/scripts/railway-deploy.ts` replaces the bare `railway up` (which tars the live CWD —
the mode-600-file deploy break, `docs/deploy/STATE.md`): resolve `--ref` to a commit SHA, refuse
any SHA not an ancestor of `origin/main`, stage a clean `git archive` tree (git-normalized modes),
run `railway up` from the stage, append an on-box single-use receipt (append-only; `--force`
overrides only the receipt, never ancestry). `RAILWAY_TOKEN` stays UNSET — the workflow runs as a
green no-op until the operator provisions it. Fixes the stale `.gridwork/project.toml` (F6,
ADR-0019): `status` scaffold→live, six-bundle description.

**Locked pre-arm requirement (security):** before `RAILWAY_TOKEN` is ever armed, it MUST live in a
protected GitHub `production` environment with a required-reviewer rule. `workflow_dispatch` runs
the _dispatched ref's own copy_ of the deploy script, so the ancestry guard is only trustworthy
when the credentialed step is gated behind environment protection. Documented in
`docs/operations.md §5`. Arming the token + any real deploy is a separate operator-gated DEPLOY act.

### D3 — Public-mirror export correctness + CI lint gate

The mirror exporter shipped a mirror that failed `bun test` and silently corrupted shipped source.
Fixed: `sanitizeSourceComments` made string/template/escaped-quote aware (was stripping `()` from
real code via a false comment span); `sanitizeAdrCitations` scoped to the removal site (its two
document-wide passes were corrupting valid API — `z.object().strict()`→`z.object.strict` — across
the public acquisition surface); a mirror lint/format CI leg added; the private repo's root eslint
now excludes `scripts/mirror-assets/**` (mirror templates import the mirror-only
`@caisson-sh/eslint-config`); `@caisson/ds-manifest` UI-detection widened to the mirror scope.
Plus `docs/gtm/oss-repo-org-marketing.md` — a repo-presentation memo (PR-work recommendations vs.
an operator-only settings checklist; zero settings changed, live mirror untouched). The W3
caisson-oss public flip stays HELD on business optics (ADR-0357 D5, unchanged).

### D4 — R2 historical backfill TOOL built; the fork stays OPEN (CAISSON-125)

`registry/scripts/r2-historical-backfill.ts` is merged: it resolves each superseded
`<id>@<version>` sidecar row to its historical source commit (git-log commit walk — most rows have
no per-version tag), packs from a disposable no-build worktree, byte-verifies against the advertised
sidecar (shasum + integrity + size) **fail-closed**, and uploads via `aws s3 cp` (the exact
`publish.yml` / `r2-parity-probe.ts` R2 mechanism — zero new credential surface). `--upload`
defaults **false**.

The tool arms nothing. The 93 live uploads are a separate operator-gated DEPLOY act. **This ADR
does NOT lock the CAISSON-125 fork** (backfill vs. prune vs. accept-advisory): the prior
2026-07-17 accept-advisory lock stands until the operator re-decides. Building the tool makes the
_backfill_ option executable; it does not choose it.

## Accepted residuals (SHIP audits)

- **Backfill tool:** head-object never-overwrite guard deferred — integrity-neutral (the byte gate
  guarantees only-correct-bytes-upload; a re-run re-uploads identical canonical bytes). The live
  git/bun/aws paths are unit-tested via dependency injection only, so a read-only dry-run precedes
  the tool's first real use.
- **`sanitizeSourceComments`:** the JS-regex-literal gap is documented in the disclosure comment
  (zero corpus cases today); a transpile-based fail-loud guardrail is deferred.

## Consequences

- The registry release flow closes the single-shot-version-PR hole in the sibling-churn net —
  pre-merge (sibling churn, both entry points) and post-publish (parity probe) both hold.
- Deploys have a provenance-pinned path ready; arming is gated on the protected-environment
  prerequisite and remains a separate operator DEPLOY act.
- The public mirror export no longer corrupts shipped source or docs; a lint gate guards it.
- The 93-object R2 backlog is executable on an operator go; the daily parity probe stays
  advisory-red until the fork is decided.

---
updated: 2026-07-25
status: live
grounds:
  - docs/state/outstanding-work.md
  - docs/state/production-readiness.md
  - docs/state/decisions-and-forks.md
  - docs/adr-index.md
---

# GitHub certification — 2026-07-25

Supersedes the stale reading in `docs/state/outstanding-work.md` and
`docs/state/production-readiness.md` — both of which called the GitHub gate "unknown, not green"
pending authorization, and both of which are updated separately to point here. That reading was
stale: the `gh` credential (account `GridWork-dev`, scopes `gist, read:org, repo, workflow,
write:packages`) has worked since 2026-06-30. This is the evidence-gathering pass those two
lines were waiting on — not a new authorization. Queries below ran live against
`caisson-sh/caisson` and `caisson-sh/caisson-oss` via `gh` (through `snip proxy` for parseable
output) on 2026-07-25.

## Verdict summary

| Area               | Verdict                 | Note                                                                      |
| ------------------ | ----------------------- | ------------------------------------------------------------------------- |
| Open PRs           | **DEFECT**              | #332 `check` job FAILED; #333 still running at query time                 |
| Actions / CI       | CERTIFIED               | workflows enumerated, required set green on main                          |
| Releases and tags  | **DEFECT**              | tags are unsigned                                                         |
| Branch posture     | ACCEPTED-RESIDUAL       | protection API 403s on Free plan — ADR-0327                               |
| Org posture        | ACCEPTED-RESIDUAL       | 2FA/public-repo flips declined 2026-07-15, re-raise at launch             |
| Public-repo timing | CERTIFIED (as expected) | `caisson-oss` still private; gated on the OSS launch program, not yet run |

## 1. Open PRs

`gh pr list --repo caisson-sh/caisson --state open --json number,title,headRefName,mergeable,statusCheckRollup`

Two open PRs, both opened 2026-07-25:

| #   | Title                                                | Branch                            | Mergeable | CI rollup                                                                                                                              |
| --- | ---------------------------------------------------- | --------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 332 | feat(site): complete compliance module depth pages   | `feature/module-depth-pages`      | MERGEABLE | `check` **FAILURE**; `standards-gate`/`registry-index`/`oscal-conformance`/`deterministic` all SUCCESS; both `native-ext` legs SUCCESS |
| 333 | feat(billing): prepare Mercury and Paddle onboarding | `feature/paddle-onboarding-setup` | MERGEABLE | `check` still **IN_PROGRESS** at query time; `standards-gate`/`registry-index`/`oscal-conformance`/`deterministic` all SUCCESS         |

`caisson-sh/caisson-oss` has zero open PRs.

**Verdict: DEFECT.** #332's `check` job (ci workflow) failed — this is one of the five CLAUDE.md
required checks (`check` · `standards-gate` · `registry-index` · `oscal-conformance` ·
`deterministic`), so the PR is not launch-ready as-is; the other four required checks on #332 are
green. #333's `check` run had not completed at query time (started 22:15:29Z, run
`30177218559`) — re-query before relying on it. This certification doesn't fix either; it's the
orchestrator's or that PR's author's job to look at run `30176611034`'s `check` job log and
re-run.

## 2. Actions

`gh workflow list --repo caisson-sh/caisson --all` — 15 active workflows: `aeo-probe`, `ci`,
`deploy-railway`, `lighthouse-ci`, `mirror-sync`, `nist-catalog-watch`, `pgrls-advisory`,
`publish`, `quality`, `r2-parity-probe`, `release-train`, `security-scan`, `support-bot`,
`tsc-native-dts-drift`, `version-pr`. None disabled.

`gh run list --repo caisson-sh/caisson --limit 30 --json conclusion` conclusion counts:

```
      1  (empty — in-progress run, #333's ci)
      1 cancelled
      1 failure
      3 skipped
     24 success
```

Failure rate over the last 30 runs: 1/30 (the #332 `check` job above) plus one `cancelled`
security-scan run on `main` at 12:03:23Z (superseded by a later push at 12:06:46Z on the same
branch, which ran and passed clean — normal GitHub Actions supersession behavior, not a defect).

Required-check set named in `CLAUDE.md` (`check`, `standards-gate`, `registry-index`,
`oscal-conformance`, `deterministic`) all exist as job names inside the `ci` and `security-scan`
workflows and ran green on `main`'s last completed run (12:06:46Z).

**Verdict: CERTIFIED.** The workflow roster and required-check names match doctrine. The one
failure and one cancellation above are both accounted for by the open-PR defect and normal
push-supersession, not systemic Actions rot.

## 3. Releases and tags

`gh release list --repo caisson-sh/caisson --limit 5`:

```
Caisson v2026.07.20.3   Latest   v2026.07.20.3   2026-07-20T18:20:23Z
Caisson v2026.07.20.2            v2026.07.20.2   2026-07-20T16:25:09Z
Caisson v2026.07.20.1            v2026.07.20.1   2026-07-20T12:56:07Z
v2026.07.19.1 — OSCAL live delivery and multi-year renewal groundwork   v2026.07.19.1   2026-07-19T11:48:51Z
v2026.07.19 — Release integrity: artifacts carry their build resolution v2026.07.19    2026-07-19T10:21:01Z
```

`gh api repos/caisson-sh/caisson/git/refs/tags` (last 3) confirms `v2026.07.20.1/.2/.3` all
exist as annotated tag objects (`object.type: "tag"`) at distinct SHAs, matching the release
train. `gh api .../git/tags/<sha>` on the latest tag (`v2026.07.20.3`, sha `326063b4…`) returns:

```json
{
  "tag": "v2026.07.20.3",
  "verification": {
    "reason": "unsigned",
    "signature": null,
    "verified": false,
    "verified_at": null
  }
}
```

**Verdict: DEFECT.** Latest release matches latest tag and the tag tree is intact (annotated,
not lightweight), but tags are **unsigned** — no GPG/SSH signature, `verified: false`. Nothing
in the repo's known ADRs (0327, 0328, 0365) commits to signed tags, so this isn't a broken
promise, but it is a real gap against a "certification" bar: an attacker with push access could
forge a tag pointing at a different commit and nothing would catch it. Not fixed here — flagged
for the orchestrator to decide whether it's in scope before launch.

## 4. Branch posture

`gh api repos/caisson-sh/caisson --jq "{default_branch, delete_branch_on_merge, private}"`:

```json
{ "default_branch": "main", "delete_branch_on_merge": true, "private": true }
```

`gh api repos/caisson-sh/caisson/branches/main/protection`:

```json
{
  "message": "Upgrade to GitHub Pro or make this repository public to enable this feature.",
  "status": "403"
}
```

**Verdict: ACCEPTED-RESIDUAL.** `default_branch: main` and `delete_branch_on_merge: true` are
both as expected (the latter applied 2026-07-15 per `docs/state/decisions-and-forks.md:203`).
The 403 on the protection endpoint is the documented Free-plan ceiling — CLAUDE.md's PR-review-gate
section already names the in-session SHIP audit lane as the substitute for branch protection,
and ADR-0327 is the prior lock recorded against this same limitation. This is not a new finding;
recording it here as the live, queried state rather than an assumption.

## 5. Org posture

`gh api orgs/caisson-sh --jq "{two_factor_requirement_enabled, members_can_create_public_repositories}"`:

```json
{
  "members_can_create_public_repositories": true,
  "two_factor_requirement_enabled": false
}
```

`gh api orgs/caisson-sh/members --jq "length"` → `1` member.

**Verdict: ACCEPTED-RESIDUAL.** Both flags read exactly as left by the operator's 2026-07-15
PF2-4 decision (`docs/state/decisions-and-forks.md:211`): 2FA requirement and the
public-repo-creation restriction were explicitly **declined for now**, with an explicit
"re-raise at launch" note. This isn't a defect against current doctrine — it's a live decision
the operator already made, restated here as confirmed-still-in-that-state rather than assumed.
Single-member org (no other accounts to worry about for now).

## 6. Public-repo timing

`gh api repos/caisson-sh/caisson-oss --jq "{private, default_branch}"`:

```json
{ "private": true, "default_branch": "main" }
```

`gh api repos/caisson-sh/caisson-oss/tags --jq length` → `0`. No releases
(`gh release list --repo caisson-sh/caisson-oss` returns empty). `pushed_at: 2026-07-20T18:26:41Z`,
matching the last `mirror-sync` run (`gh run list --repo caisson-sh/caisson --workflow
mirror-sync --limit 5` — 5/5 `success`, most recent 2026-07-20T18:26:08Z).

**Verdict: CERTIFIED (state matches doctrine).** `caisson-oss` is still private, as it must be —
`docs/state/decisions-and-forks.md:216-222` (the OSS-mirror launch-program lock, ADR-0318) gates
the public flip on the dedicated sandbox/clean-room audit phase (Kickoff-L folded in as W0),
which has not run yet. The mirror itself is live and current (last synced 2026-07-20, matching
the `v2026.07.20.3` release train), it's just not flipped public — that's a future, explicitly
gated act, not a gap in this certification.

## What could not be determined

- **Deployed-check job logs for #332.** I read the rollup (job named `check`, conclusion
  `FAILURE`) but did not open the Actions log to find the specific assertion/test that failed —
  that's an EXECUTE-time fix on that PR's branch, out of scope for an evidence-gathering
  certification and outside this task's file list.
- **#333's final CI result.** Its `check` job was still `IN_PROGRESS` at query time
  (`30177218559`); re-run the PR query before relying on this doc for that PR's mergeability.
- **Whether any other org members exist under a different, non-queryable visibility setting.**
  The `members` count of 1 is what the token's scopes can see; `read:org` should be sufficient
  for a full member list on an org this size, but I have not independently confirmed there are
  no invited-but-pending seats (the members endpoint only lists active members).
- **GPG/SSH key provisioning for signed tags**, if the orchestrator decides DEFECT #3 (unsigned
  tags) needs fixing before launch — that's a decision + implementation task, not something this
  evidence pass resolves.

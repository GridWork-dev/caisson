> **SUPERSEDED 2026-09-25 by ADR-0428 — see `outputs/specs/oss-pivot/SPEC.md`.** The whole repo goes public; the mirror model below is retired.

# SPEC — OSS mirror launch program (sandbox audit → curated history → release train → public flip + GTM)

**Status: LOCKED — ADR-0318 (2026-07-10, two picker rounds). Fork outcomes: F1 keep vessel ·
F2 milestone backfill + append-only forward · F3 never backdate (dated at cut-over) · F4
Kickoff-L folds in as W0 · F5 pre-launch window → Show HN · R1 GH-Release-publish trigger ·
R2 everything rides (incl. site/docs + fleet redeploy; the Release click IS the DEPLOY gate) ·
R3 readiness script + per-release checklist · R4 fresh full re-audit per release. Tags:**
`external-system`, `security` (export leak surface), `docs`, `infra`.
**Grounds:** ADR-0222 (public distribution: `caisson-sh` org, `@caisson-sh` npm scope,
mirror-owned npmjs publishing) · ADR-0223 (registry self-hosted npm delivery) · the mirror
exporter + sync pipeline (PR #64: `scripts/export-public-mirror.ts`, `mirror-sync.yml`,
`scripts/mirror-assets/`) · `outputs/kickoffs/KICKOFF-L-launch-release.md` (READY, never run) ·
GTM research `outputs/research/oss-launch-gtm-2026-07-10.md` (workflow `wf_7a7952c2-474`).

## Goal

Take `caisson-sh/caisson-oss` from a private one-commit generated snapshot to a **public,
launch-grade OSS repo** — validated end-to-end in a sandbox first, carrying a curated history the
operator chooses, and launched with a research-backed GTM motion. The publish gates
(`CAISSON_PUBLISH_DRY_RUN=true`, the mirror npm `confirm=publish` manual dispatch, the repo
private flag) stay closed until the operator flips each one.

## Current state (verified 2026-07-10)

- `caisson-sh/caisson-oss`: **private**, exactly one commit (`chore: mirror sync from 1bf4dcd`),
  last pushed 2026-07-10T19:11Z by the now-working mirror-sync pipeline.
- The sync's recorded design is the **snapshot model** — single-commit force-push each run;
  "a real multi-commit history on the mirror would imply a development surface it isn't"
  (`mirror-sync.yml` header). **This program's F2 re-opens that decision** at the operator's
  direction (2026-07-10: chunked milestone history "to show some development").
- Open set: 16 Apache-2.0 packages + `tooling/{tsconfig,eslint-config}`; exporter renames the
  npm scope to `@caisson-sh/*` and runs a self-containment gate.
- Public-flip preconditions already tracked (`docs/state/outstanding-work.md` §1): the P0
  sequencing gate — remaining credential rotations + a fresh-export entitlement-token scan run.
- Kickoff-L (AEO docs metadata · directory-batch staging · the 92-changeset version cut) is
  READY and unexecuted; the version cut is the merge-conflict maximizer and repo-wide.

## Waves

### W0 — Kickoff-L items, folded in (F4 locked: fold)

Kickoff-L's three items become program tasks: the AEO docs-metadata fix, the directory-batch
staging (staged, not fired — trigger unchanged), and the 92-changeset version cut. The version
cut lands **before** the mirror cut-over so the public repo shows post-cut versions + drained
changesets + real CHANGELOGs. `outputs/kickoffs/KICKOFF-L-launch-release.md` is absorbed —
archive it at execution.

### W1 — Sandbox validation phase (operator-stated 2026-07-10, not a fork)

A dedicated clean-room phase, gating everything after it:

1. **Clean-room install of the full catalog** — every OSS package (from a fresh `mirror-out`
   export / tarballs) **and** every commercial package + bundle (via the self-hosted registry
   delivery path with a real license token), in an isolated environment with no access to the
   monorepo checkout or `~/.gridwork` env.
2. **Generator run** — `create-caisson` from scratch as a new customer; the generated app must
   build + pass its own checks using only published artifacts.
3. **Prose/instruction/setup audit** — follow the public docs, READMEs, and setup instructions
   _verbatim_; every command either works or gets a finding. Audit all public prose for
   accuracy, stale claims, internal-only references, and broken links.
4. **Leak + firewall scan on the export** — secrets scan, pro-private firewall check
   (media-pipeline patterns only, never implementation), entitlement-token scan-gate run on the
   fresh export (this doubles as the tracked P0 flip precondition).

Output: one audit report (`outputs/audit/oss-sandbox-audit-<date>.md`) + a fix list; **zero P0/P1
findings is the gate** to W2.

### W2 — History cut-over (forks F1–F3)

Replace the mirror's single snapshot with the operator-chosen history shape, then re-point the
ongoing sync to **append** future "mirror sync from <sha>" commits on top (no more force-push —
the backfilled base must never be blown away by the next sync).

**Backfill mechanics (if F2 = milestone backfill):** milestones are **real exports at real
source SHAs** — run the current exporter against checked-out historical tree states of the
private repo at the true milestone merges (P0/P1 foundations → Wave-0 → open-core split →
generator → P6 → Stage-2 → harvest → six-bundle catalog → 1.0 cut), each committed sequentially
onto a fresh mirror branch. Packages absent at a milestone simply aren't in that commit — the
history reads as genuine progression because it is. **Binding:** every backfilled milestone
passes the same self-containment + leak + license gates as HEAD — in particular, content that
was later carved out to commercial must never appear in an old snapshot, and only today's open
set with Apache LICENSE files ships at any point in the history. Where the exporter can't run
cleanly against an old tree, drop that milestone rather than hand-fabricate a diff.

### W4 — Release train (R1–R4 locked)

Development stays in the private repo; a release is the operator publishing a GitHub Release
(draft auto-generated when the changeset version-cut PR merges). The train then runs, in order:
**readiness gate** (script: CI green on the SHA · changesets drained · CHANGELOGs written ·
`bun run sot` green · the R4 audit note on file · docs freshness; plus the per-release checklist
file with the human items — marketing surfaces updated, announcement drafted; any red blocks) →
**propagation**: registry tarballs + index republish · OSS mirror append-sync · `@caisson-sh/*`
npm publish · site + docs redeploy · fleet service redeploy. The Release-publish click is the
operator DEPLOY gate exercised — the train never fires autonomously. R4: every release gets a
fresh full SHIP-audit-lane review of the cumulative diff since the last release tag. The
current push-triggered `publish.yml` / `mirror-sync.yml` paths retire into the train here.

### W3 — Public flip + GTM launch (operator-gated, F5 locked: window → Show HN)

Preconditions: W1 gate green, W2 landed, W4 train live, the tracked P0 rotations done, the
directory batch staged. Then the **pre-launch window**: repo → public + first npm publish +
Awesome-list PRs + newsletter submissions, 2–4 weeks BEFORE the Show HN anchor (research §4:
Show HN star half-life ~24h — the window compounds). Product Hunt optional week-2 follow-up.
Channel plan + README lead claim per `outputs/research/oss-launch-gtm-2026-07-10.md` §4–5.

## Forks — ALL LOCKED 2026-07-10 → ADR-0318 (rows kept for the record; outcomes in the Status header)

- **F1 — repo vessel:** keep `caisson-oss` + rewrite history vs delete-and-recreate fresh.
  Note: the fine-grained `MIRROR_PUSH_TOKEN` PAT is scoped to the existing repo by id — a fresh
  repo means re-scoping the PAT + re-wiring the secret; outcome is otherwise identical on a
  private one-commit repo.
- **F2 — history shape:** (a) curated milestone backfill (operator's stated lean) · (b) keep the
  recorded single-snapshot model · (c) no backfill, but flip sync to append-only from cut-over
  forward. Choosing (a) or (c) supersedes the PR #64 snapshot rationale. **Research verdict
  (§2):** squashed-single-commit is the private→public industry default (Citus, Windows
  Calculator) with zero evidenced credibility penalty for a named org; the documented backlash
  fires on _unexplained_ thin history, cured by one first-screen README sentence naming the
  generated-mirror model. Backfill has no evidenced upside.
- **F3 — commit dating:** COLLAPSED by research §2, max confidence — **never backdate**:
  backdated timestamps are the documented signature of repo-laundering/IP-theft scams and are
  auto-detected. If F2 = backfill anyway, every commit dates at cut-over with the real milestone
  date named in the commit message only.
- **F5 — launch motion (W3 shape):** pre-launch window (repo public + npm publish + Awesome-list
  PRs + newsletter submissions 2–4 weeks BEFORE a Show HN anchor — research §4: Show HN star
  half-life ~24h, 92% gone by 48h, so the window does the compounding) vs same-day big-bang vs
  quiet flip with no HN event scheduled.
- **F4 — Kickoff-L sequencing:** run L first as W0 (recommended — the mirror should show the
  post-cut state) vs fold L's items into this program vs run L independently later.

## Binding rules

- **No publish, no flip, no npm dispatch in this program without the named operator act** —
  building W1/W2 never implies W3.
- Backfilled history = real exports at real SHAs only; never hand-authored synthetic diffs.
- The sandbox environment gets no monorepo checkout, no `~/.gridwork` env, no vault access;
  a commercial license token minted for the test is revoked after.
- All existing gates stay: exporter self-containment, `CAISSON_PUBLISH_DRY_RUN`, the mirror
  `confirm=publish` dispatch, changeset-prose rule during the W0 version cut.

## Exit criteria

- Sandbox audit report on file with zero open P0/P1; generator-built app green from published
  artifacts only.
- Mirror carries the operator-chosen history; next mirror-sync run **appends** (proven by a
  post-cut-over sync leaving the base intact).
- GTM research doc on file; launch channel plan staged; flip checklist reduced to operator acts.
- ADR filed for the F1–F4 locks; fork board updated; `bun run sot` green.

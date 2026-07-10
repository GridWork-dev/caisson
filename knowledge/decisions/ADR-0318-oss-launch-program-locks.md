# ADR-0318 — OSS launch program locks: sandbox gate, mirror history, Kickoff-L fold, gated release train

**Status:** accepted · 2026-07-10 (OSS-launch picker, two rounds same sitting). **Tags:**
`external-system`, `security`, `infra`, `docs`. Locks
`outputs/specs/oss-launch/SPEC-oss-launch-program.md` (DRAFT → LOCKED).

## Context

The operator held the OSS mirror publish (2026-07-10): `caisson-sh/caisson-oss` stays private
(one generated snapshot commit) until a dedicated sandbox validation phase has proven the full
catalog — OSS **and** commercial — installs and reads clean from published artifacts alone, and
until the mirror's history shape and the release mechanics are deliberately chosen. GTM research
ran first (workflow `wf_7a7952c2-474`, 5 exa lanes + synthesis →
`outputs/research/oss-launch-gtm-2026-07-10.md`); the picker ran two rounds against it.
Kickoff-L (AEO docs metadata · directory-batch staging · the 92-changeset version cut) was the
planned-but-never-run 4th kickoff of the I/J/K sitting and is absorbed here.

## Decisions (operator-locked)

1. **F1 — vessel: keep `caisson-sh/caisson-oss`.** History is force-pushed once at cut-over;
   the repo-id-scoped `MIRROR_PUSH_TOKEN` and secret wiring survive.
2. **F2 — history shape: milestone backfill + append-only forward.** One-time curated backfill
   of real exporter runs at real historical source SHAs, then the sync flips from
   force-push-snapshot to **append-only** "mirror sync from <sha>" commits. This supersedes the
   PR #64 single-snapshot rationale recorded in `mirror-sync.yml`'s header (the research's
   literal rec was keep-snapshot; the operator chose backfill+append with the safety rails
   below). A first-screen README sentence names the generated-read-only-mirror model — the
   research's max-confidence cure for thin-history scrutiny.
3. **F3 — commit dating: never backdate** (max-confidence research rule — backdated timestamps
   are the documented signature of repo-laundering scams). Every backfilled commit is dated at
   cut-over; the real milestone date appears in the commit message only. Backfilled milestones
   pass the same self-containment + leak + license gates as HEAD; content later carved out to
   commercial never appears at any point in the history; where the exporter can't run cleanly
   against an old tree, the milestone is dropped, never hand-fabricated.
4. **F4 — Kickoff-L folds into this program as W0.** Its three items (AEO docs-metadata fix,
   directory-batch staging, the version cut) become program tasks; the version cut still runs
   before the mirror cut-over so the public repo shows post-cut versions, drained changesets,
   and real CHANGELOGs.
5. **F5 — launch motion: pre-launch window → Show HN anchor.** Repo public, first npm publish,
   Awesome-list PRs, and newsletter submissions open a 2–4-week window BEFORE the Show HN event
   (research: Show HN star half-life ~24h, 92% gone by 48h — the window compounds, the spike
   doesn't). Product Hunt is an optional week-2 follow-up.
6. **R1 — release trigger: GitHub Release publish.** The changeset version-cut PR merge
   auto-generates a draft Release with notes; the operator's Publish click is the release act
   that fires the train. The current every-push triggers (registry publish on main push,
   mirror-sync on open-path push) retire into the train when it ships.
7. **R2 — train scope: everything rides.** Registry tarballs + index republish, OSS mirror
   append-sync, `@caisson-sh/*` npm publish, site + docs redeploy, **and** fleet service
   redeploy. Doctrine reading recorded: DEPLOY stays operator-gated because the trigger IS the
   operator's explicit Release-publish click — the train never fires autonomously.
8. **R3 — gates: readiness script + per-release checklist file.** A release-readiness script
   verifies CI green on the release SHA, changesets drained, CHANGELOGs written, `bun run sot`
   green, the audit artifact on file, and docs freshness; a committed per-release checklist
   carries the human items (marketing surfaces updated, announcement drafted). Any red blocks
   the train.
9. **R4 — audit gate: fresh full re-audit every release.** The cumulative diff since the last
   release tag gets a full in-session SHIP-audit-lane review each release (operator chose the
   strongest option over artifact-assembly from per-PR audits); the resulting note is the R3
   audit artifact.

## Consequences

- Execution is a normal SPEC→PLAN→EXECUTE pickup off the locked spec; wave order
  W0 (Kickoff-L items) → W1 (sandbox audit, gate) → W2 (backfill + append cut-over) →
  W4 (release train) → W3 (window + Show HN, each step an operator act).
- The publish gates stay closed until their operator acts: repo private flag,
  `CAISSON_PUBLISH_DRY_RUN=true`, the mirror npm `confirm=publish` dispatch — the train
  absorbs these when it ships, with the Release-publish click as the single gate.
- `mirror-sync.yml`'s snapshot-model header comment is superseded and gets rewritten in W2.
- The README lead claim + channel plan follow the research doc §5/§4 (compliance primitives in
  code you own; "Bun-native" secondary; bounded honestly — not a CPA-audit or Vanta swap-in).

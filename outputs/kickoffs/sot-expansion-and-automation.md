# Kickoff — SOT expansion + session automation + GTM distillation

**Authored:** 2026-07-05 (site-design-2 close-out). **Builds:** NEXT session.
**SPEC (locked scope):** `outputs/specs/sot-expansion/SPEC.md`.
**Branch:** `feat/sot-expansion` off `main`. **Session model routing:** doc distillation +
bounded tool build → **sonnet**; synthesis/consistency + CLAUDE.md rework → **opus** main thread;
grep/classify sweeps → **haiku**.

## Operator locks carried in (2026-07-05 picker — do not re-ask)

SOT set = **Core + architecture map** · automation = **ONE command** (`bun run sot`) · GTM =
**full distillation this session, parallel workflows** · open forks surfaced = **R3 compliance
split + Agentic-Dev inspector** (three.js spike stays deferred).

## Session flow

1. **Picker round FIRST** — the SPEC §5 fork queue (R3 price-relock · inspector Forks A/B ·
   updates-window · credit rollover). Locks → ADRs; anything unlocked stays out of this build.
2. **Four parallel workstreams** (disjoint trees, one Workflow each or one fan-out):
   - **W1 SOT docs** — `docs/state/outstanding-work.md` (absorb readiness-and-backlog + the
     opportunity-backlog residue, tombstone both) · `docs/deploy/STATE.md` (seed from the
     07-01→07-05 waves) · `docs/architecture.md` (`grounds:` frontmatter) · frontmatter
     convention across `docs/state/` · CLAUDE.md item-2 trim to a pointer.
   - **W2 `bun run sot`** — `tooling/scripts/sot-check.ts`, the 6 advisory checks + `--update`
     checklist mode (SPEC §2 table). Unit-test each check against a synthetic drift.
   - **W3 GTM** — `docs/gtm/` per the SPEC §3 table (8 files, one agent each + synthesis pass).
   - **W4 repo-improvement hygiene wave** — the build-now rows of
     `outputs/specs/repo-improvement-program/SPEC.md` (#4 dep catalog with the zod-line
     mini-audit first · #5 build-vs-buy page via the copy gate · #6 Content-Signals header ·
     #7 knip advisory · #8 renovate · #10 changesets policy). Own branch/PR; the program spec
     owns its Verify. Trigger-parked rows (#9 #11 #12 #13) do NOT build this session.
3. **Verify goal-backward** against the SPEC's Verify block; full gate + `bun run sot` green;
   one PR per workstream or one stacked set — merge on green, then the end-of-session
   convention (run `sot`, wrap) applies for the first time to its own build session.

## Inputs on disk

- Research: `outputs/research/monorepo-bigpicture-2026-07.md`, executed via
  `outputs/specs/repo-improvement-program/SPEC.md` (13-gap disposition + do-not-copy ledger; its
  two revenue-policy forks join the SPEC §5 picker queue).
- The frozen docs to absorb: `docs/state/readiness-and-backlog.md` (final banner 2026-07-05),
  `docs/state/opportunity-backlog.md` (residue re-baselined 2026-07-05).
- Archive pattern precedent: the 2026-07-05 sweep (`docs/archive/` + tombstone stubs).
- GTM raw layer: `outputs/research/market-*.md`, `options.md`, `support-strategy.md`,
  `docs/state/providers.md`, `docs/state/go-live-legal-and-entity.md`, the GTM ADR set.

## Boundaries

Never auto-decide a fork (R3 especially — price-relock gate). `sot` never auto-writes prose.
No new required CI check without a later explicit lock. Linear owns WORK, git owns DECISIONS —
the tracker does not mirror into Linear.

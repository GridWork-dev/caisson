# Kickoff A (docs tree) — SOT expansion + session automation + GTM distillation

**Authored:** 2026-07-05; **split into A/B** the same day (operator picker: split by tree —
this is the DOCS-tree kickoff; the code-tree sibling is
`outputs/kickoffs/KICKOFF-B-hygiene-audit-remediation.md`). **Builds:** NEXT session, parallel
with Kickoff B (worktree-isolated, trees are disjoint).
**SPEC (locked scope):** `outputs/specs/sot-expansion/SPEC.md`.
**Branch:** `feat/sot-expansion` off `main` (worktree). **Session model routing:** doc
distillation + bounded tool build → **sonnet**; synthesis/consistency + CLAUDE.md rework →
**opus** main thread; grep/classify sweeps → **haiku**.

## Operator locks carried in (2026-07-05 pickers — do not re-ask)

SOT set = **Core + architecture map** · automation = **ONE command** (`bun run sot`) · GTM =
**full distillation this session, parallel workflows** · open forks surfaced = **R3 compliance
split + Agentic-Dev inspector** (three.js spike stays deferred) · kickoff split = **by tree**
(docs here; hygiene wave + audit remediation moved to Kickoff B).

## Session flow

1. **Picker round FIRST** — the SPEC §5 fork queue (R3 price-relock · inspector Forks A/B ·
   updates-window · credit rollover). Locks → ADRs; anything unlocked stays out of this build.
2. **Three parallel workstreams** (disjoint doc trees, one Workflow each or one fan-out):
   - **W1 SOT docs** — `docs/state/outstanding-work.md` (absorb readiness-and-backlog + the
     opportunity-backlog residue, tombstone both) · `docs/deploy/STATE.md` (seed from the
     07-01→07-05 waves) · `docs/architecture.md` (`grounds:` frontmatter) · frontmatter
     convention across `docs/state/` · CLAUDE.md item-2 trim to a pointer (research gap #3 —
     the one repo-improvement row that rides here because it edits this tree).
   - **W2 `bun run sot`** — `tooling/scripts/sot-check.ts`, the 6 advisory checks + `--update`
     checklist mode (SPEC §2 table). Unit-test each check against a synthetic drift.
   - **W3 GTM** — `docs/gtm/` per the SPEC §3 table (8 files, one agent each + synthesis pass).
3. **Verify goal-backward** against the SPEC's Verify block; full gate + `bun run sot` green;
   one PR per workstream or one stacked set — merge on green, then the end-of-session
   convention (run `sot`, wrap) applies for the first time to its own build session.

## Inputs on disk

- Research: `outputs/research/monorepo-bigpicture-2026-07.md`, executed via
  `outputs/specs/repo-improvement-program/SPEC.md` (13-gap disposition + do-not-copy ledger; its
  two revenue-policy forks join the SPEC §5 picker queue; its build-now hygiene wave = Kickoff B).
- The frozen docs to absorb: `docs/state/readiness-and-backlog.md` (final banner 2026-07-05),
  `docs/state/opportunity-backlog.md` (residue re-baselined 2026-07-05).
- Archive pattern precedent: the 2026-07-05 sweep (`docs/archive/` + tombstone stubs).
- GTM raw layer: `outputs/research/market-*.md`, `options.md`, `support-strategy.md`,
  `docs/state/providers.md`, `docs/state/go-live-legal-and-entity.md`, the GTM ADR set.

## Boundaries

Never auto-decide a fork (R3 especially — price-relock gate). `sot` never auto-writes prose.
No new required CI check without a later explicit lock. Linear owns WORK, git owns DECISIONS —
the tracker does not mirror into Linear. Coordination with Kickoff B: `sot` check #6 (changeset
preflight) must not assume B's tree state — both kickoffs merge through the ordinary gate,
whichever lands second rebases.

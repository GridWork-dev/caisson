# SPEC — SOT doc-set expansion + one-command session automation + GTM distillation

**Status:** LOCKED scope (operator picker 2026-07-05, site-design-2 close-out) — BUILD NEXT SESSION.
**Tags:** none risk-bearing (docs + one advisory tool; the fork queue in §5 is picker-gated, not build).
**Kickoff:** `outputs/kickoffs/sot-expansion-and-automation.md`.
**Research grounding:** `outputs/research/monorepo-bigpicture-2026-07.md` (5-angle exa sweep) + the
Wardfile SOT-shape recon (this session). Wardfile is the model for the doc-set SHAPE only — it has
no doc automation; §3 is designed fresh for caisson.

## Goal

One place answers "what is true right now" (state), "what is left" (work), and "what runs where"
(architecture) — kept honest by a single command run at the end of every session instead of
hand-stacked prose banners. Plus: the business side of the product gets a dedicated, distilled home
(`docs/gtm/`) instead of being scattered across `outputs/research/` and ADR prose.

## Operator locks (2026-07-05 picker — do not re-ask)

1. **SOT set = Core + architecture map** (not the full Wardfile surface): outstanding-work tracker ·
   deploy log · architecture map · frontmatter freshness · CLAUDE.md hierarchy update.
2. **Automation = ONE command** (`bun run sot`) — not a hook, not a cron.
3. **GTM = FULL distillation in the build session**, parallelizable with workflows.
4. **Fork queue** (§5): R3 compliance split + Agentic-Dev inspector are OPEN and surfaced; the
   three.js signature spike stays deferred.

## 1. SOT core doc set

### 1.1 `docs/state/outstanding-work.md` — the single live tracker

The Wardfile-pattern bucketed tracker. **Absorbs** `docs/state/readiness-and-backlog.md` (frozen
2026-07-05) and the residue/status half of `docs/state/opportunity-backlog.md`; on absorption both
move to `docs/archive/` with tombstone stubs (same pattern as the 2026-07-05 sweep).
Buckets (one table each, every row cites its ADR/spec/PR):

- **Operator-owed** — launch acts only the human can do (Paddle production account, the three §1.1
  credential rotations, CF-Access flip, 1Password vault, caisson-oss public flip).
- **Build-gated** — specced + locked, awaiting a build session.
- **Trigger-parked** — parked BY DESIGN with a named revisit trigger (the wave-6 28 rows, adapter
  remainder, verticals). Opportunity-side detail stays in `opportunity-backlog.md` §3–§8 until a
  later consolidation proves worth it — do NOT copy 100 rows into the tracker; link the sections.
- **Recently closed** — last ~2 sessions only, then rows fall off (git history keeps the rest).

### 1.2 `docs/deploy/STATE.md` — the deploy log

Reverse-chronological; one entry per deploy act: date · services/SHAs · WHY (consumed-package diff
per the deploy-scoping rule) · **pasted live-verify output** (curl probes, health checks). Seeded
retroactively with the 2026-07-01→07-05 waves from the build-state banners.

### 1.3 `docs/architecture.md` — the map

One page: monorepo topology (packages/services/apps/registry/infra), the trust boundaries
(open↔commercial, money/license seams, RLS), the live fleet (Railway services + Worker + DNS), and
the gate stack (check · standards-gate · greptile-gate · registry-index · oscal-conformance).
Frontmatter carries `grounds:` — the file paths that PROVE each section (e.g.
`tooling/standards-gate/src/checks.ts`, `infra/terraform/main.tf`) so `sot` can flag drift when a
grounds file changes after `updated:`.

### 1.4 Frontmatter freshness (replaces stacked banners)

Every `docs/state/*.md` + the §1.1–1.3 docs get YAML frontmatter:

```yaml
---
updated: 2026-07-05
status: live | frozen | archived
grounds: [paths the claims are verified against]
---
```

New truth EDITS the doc + bumps `updated:` (git history is the timeline); stacked
"supersedes-the-banner-above" paragraphs are retired. Existing historical banners are collapsed
opportunistically, not big-banged — `build-state.md`'s timeline stays until its own rework.

### 1.5 CLAUDE.md rework (research gap #3)

The SoT-hierarchy item 2 run-on (the full 0001–0242 inline ADR catalog, ~700 words on one wrapped
line, appended every merge) is cut to: the ceiling number + `docs/adr-index.md` as the catalog +
a one-line convention note (append-only, ADR-0088 renumbering). Every agent session loads
CLAUDE.md; the catalog is a per-merge context tax the index file already pays for.

## 2. `bun run sot` — the one command

`tooling/scripts/sot-check.ts` (sibling of `vault-parity-check.ts` / `railway-env-sync.ts`), root
`package.json` script `sot`. **Advisory by design** — prints a drift report, exits non-zero on
drift, NEVER auto-writes state prose (the never-auto-decide law extends to docs: the tool detects,
the session author fixes).

Checks (all offline-safe; `gh`-dependent checks degrade to SKIP):

| #   | Check                    | Drift signal                                                                                                                  |
| --- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | ADR ceiling parity       | highest `knowledge/decisions/ADR-*.md` ≠ CLAUDE.md ceiling ≠ `docs/adr-index.md` tail ≠ `decisions-and-forks.md` ceiling line |
| 2   | Frontmatter freshness    | any `grounds:` file has commits newer than the doc's `updated:`                                                               |
| 3   | Archive integrity        | a `status: live` doc links a `docs/archive/` path without going through its tombstone; or an archived doc is edited           |
| 4   | Branch hygiene           | local branches besides `main` + the current session branch; worktrees beyond the session's                                    |
| 5   | Tracker vs reality       | `outstanding-work.md` rows citing a PR that is merged/closed (via `gh`, SKIP offline)                                         |
| 6   | Changeset gate preflight | changed versioned packages without a named changeset (reuses the standards-gate logic, catches it before CI does)             |

`bun run sot --update` additionally prints a ready-to-apply edit checklist (file + line + suggested
new value) for #1/#2/#5. End-of-session convention (documented in CLAUDE.md): run `bun run sot`
before the wrap report; a green run is part of "gates green".

**Explicitly NOT built** (research "do-not-copy" list): no LLM doc-sync CI bot, no auto-drafted doc
PRs, no ADR-enforcement tooling.

## 3. `docs/gtm/` — full distillation (parallel workflows)

Charter: `docs/gtm/` owns the BUSINESS side — positioning, pricing rationale, market intel,
channels, tools/COGS, legal posture, and the gap ledger. Distilled prose, every claim cited to its
ADR/research file; `outputs/research/` stays the raw layer.

| File                   | Distills from                                                                     |
| ---------------------- | --------------------------------------------------------------------------------- |
| `README.md`            | charter + index (seeded this session)                                             |
| `positioning.md`       | ADR-0040/0080, specs/04, positioning kickoff                                      |
| `pricing-packaging.md` | ADR-0012/0095/0106/0129/0137/0222/0227/0238/0240 + pricing-analyst memos          |
| `market-intel.md`      | `outputs/research/market-*.md`, options.md, competitor scrapes                    |
| `channels-launch.md`   | ADR-0079 SEO/AEO, glossary program, Discord/support strategy, launch sequencing   |
| `tools-cogs.md`        | `docs/state/providers.md` $ table, Railway/Grafana/Paddle/CI stack, per-seat subs |
| `legal-entity.md`      | `docs/state/go-live-legal-and-entity.md` + Paddle MoR posture                     |
| `gaps-and-plays.md`    | `outputs/research/monorepo-bigpicture-2026-07.md` §2 gap table + §3 do-not-copy   |

Build shape: one Workflow fan-out (one sonnet agent per file, opus synthesis/consistency pass),
runnable in parallel with §1/§2 (disjoint trees).

## 4. Whole-repo improvement program — OWNED ELSEWHERE

The research wave's full execution vehicle is **`outputs/specs/repo-improvement-program/SPEC.md`**
— the 13-gap disposition table (build-now hygiene wave #4–#8/#10, trigger-parked measurement loops,
parked affiliate) plus the do-not-copy anti-decision ledger. This SPEC owns only the one row that
edits the same tree as §1 (the CLAUDE.md trim, §1.5). The program's hygiene wave runs as its own
branch/PR, parallelizable with the §1–§3 workstreams. Its two revenue-policy forks join the §5
queue below.

## 5. Fork queue — operator picker at build-session start (DO NOT auto-decide)

| Fork                                               | Shape                                                                                             | Gate                                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **R3 compliance god-package split**                | split framework-catalog / evidence-assembly / signing into sellable surfaces                      | **price re-lock FIRST** (supersedes the ADR-0227 $799 anchor math) — then its own SPEC |
| **Agentic-Dev Next.js inspector**                  | Fork A: `/dashboard` route group vs standalone app · Fork B: agent-memory read-access shape       | code gap only; substrate (`agent-kernel`/`agent-runner`) built                         |
| **Perpetual-license updates window** (research #1) | AG-Grid-style "this version + N-months updates, renewal for new majors" vs unbounded free updates | MUST land before the checkout flip — retrofit is a trust cost                          |
| **Credit rollover/top-up policy** (research #2)    | pooled rollover + top-ups vs hard monthly reset                                                   | pricing-page commitment; wallet plumbing exists                                        |

## Verify (goal-backward)

1. `bun run sot` exists, is green on a clean tree, and each check #1–#6 fires on a synthetic drift
   (unit-tested with fixture trees where cheap).
2. `outstanding-work.md` + `deploy/STATE.md` + `architecture.md` exist with frontmatter;
   readiness-and-backlog + the opportunity-backlog residue absorbed + tombstoned.
3. CLAUDE.md item-2 is a pointer (catalog gone), ceiling correct, and a full-gate run stays green.
4. `docs/gtm/` populated per §3, every file citing sources.
5. Fork queue §5 presented to the operator in one picker round; locks filed as ADRs.
6. The repo-improvement program's build-now wave verifies against ITS spec
   (`outputs/specs/repo-improvement-program/SPEC.md` §Verify), not this one.

## Non-goals

No auto-writing of decision/state prose · no new required CI check (advisory only until promoted
by a later lock) · no Linear mirroring of the tracker (Linear owns WORK, git owns DECISIONS) ·
no doc-gen bots.

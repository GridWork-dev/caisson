# CLAUDE.md — Caisson working rules

Additive to the global gridwork-core surface (security floor, retrieval doctrine, coding
discipline auto-load from there). This file holds only what is specific to this repo.

**What this repo is:** a productized monorepo library — a composable base + **six bundles**
(Compliance · AI-Production · Local-first · Agentic-Dev · Provenance · Everything, ADR-0257/0258;
the four editions DISSOLVED into these 2026-07-06, legacy ids alias forever) + a `create-caisson`
generator + a custom support service. Sold one-time + per-module + subscription/credits.
Full founding spec: `specs/00-product-spec.md`. Built **rebuild-clean** from proven GridWork
repos — never a port. **Name + positioning LOCKED: Caisson · `@caisson/*` · `caisson.sh`**
(ADR-0041 name · ADR-0040 hero · ADR-0042 design).

## The one operator rule

**Never auto-decide a fork.** Every open decision lives in `docs/state/decisions-and-forks.md`
until the operator locks it; recommendations are labeled with confidence + evidence, then wait.
Locks are recorded as ADRs in `knowledge/decisions/` (append-only, `ADR-NNNN-slug.md`, never
edited — supersede with a later ADR).

## Source-of-truth hierarchy

1. `docs/state/decisions-and-forks.md` — live board (locked + open)
2. `knowledge/decisions/` — the ADRs themselves. Append-only (`ADR-NNNN-slug.md`, never edited — supersede
   with a later ADR; collisions at merge renumber per ADR-0088). **Ceiling: ADR-0428** (0335-0339 reserved unused; 0334 = Kickoff-S motion language v2). The full
   catalog — every number, title, and supersession chain — is `docs/adr-index.md`; do NOT restate
   it here. The per-sitting lock narratives formerly inlined in this clause are archived verbatim
   in `docs/archive/build-history.md`.
3. `specs/` — locked concept docs; `specs/00-product-spec.md` is the founding spec
4. `docs/build-state.md` — live per-package build truth (the founding `plan.md` + `SUMMARY.md` are archived history → `docs/archive/`)
5. `outputs/` — session artifacts (kickoffs, research, syntheses)

On conflict, the higher item wins.

**Session-wrap convention:** run `bun run sot` before the wrap report — the advisory drift tool
(ADR-ceiling parity · frontmatter freshness · archive integrity · branch hygiene · tracker-vs-PR
reality · changeset preflight); a green run is part of "gates green", `--update` prints the fix
checklist. The live work tracker is `docs/state/outstanding-work.md` · deploy log
`docs/deploy/STATE.md` · architecture map `docs/architecture.md`.

## Cadence (spec-first)

Research → spec → ADR lock → code. **No product code before the spec/ADR it implements is
locked.** Current state: the full platform is SHIPPED in-repo and LIVE — base substrate + six bundles +
generator + registry Worker (registry.caisson.sh) + the Railway fleet (site · admin · license ·
docs-RAG · support-bot) + Grafana Cloud (sole OTLP sink, replacing self-hosted SigNoz — removed
2026-07-01, ADR-0177) + the local intel daemon, Paddle SANDBOX commerce, and the
`caisson-oss` mirror + npm delivery armed (publish stays operator-gated). Live per-package truth:
`docs/build-state.md` · deploy log `docs/deploy/STATE.md` · work tracker
`docs/state/outstanding-work.md`. The full build chronology (P0 through the 2026-07 kickoff
waves, every PR/ADR sitting) is archived in `docs/archive/build-history.md`.

**Execution waves (ADR-0328 D6):** multi-cluster backlogs run as PARALLEL worktree sessions
by default — one PR each (hard), push-not-merge, boards frozen, dedicated reconcile session at
2+ branches. Full convention: `docs/ops/parallel-session-waves.md`.

## Engineering invariants (locked, ADR-0002 — apply to all product code)

- **TypeScript strict**, Bun runtime/PM (never npm/yarn). **Zod `.strict()` at every boundary.**
  No `any`, no `console.log` in product code. `crypto.randomUUID()` for IDs.
- **Credits/money are integer units** — never floats (ADR-0007).
- **Append-only versions** — locked artifacts immutable; amendments supersede (ADR-0006).
- **`fetchWithTimeout` on every outbound fetch; `crypto.timingSafeEqual` for every secret/token/
  license compare.** Fail-closed RLS (ADR-0005), credit gates (402), license checks.
- **One standards gate:** `tooling/` is the single lint-policy/tsconfig/test source; a package ships
  only through it. Golden-file regression before any compliance logic.
- **Composable packages** (ADR-0003): editions are compositions, never forks; a package never
  depends "up" on an edition.

## Pro-private firewall (binding)

Nothing from `media-pipeline` (pro-private) may seed any package — **patterns/ideas only, never
implementation**. The harvestable license kit is taken from PUBLIC `tessera`.

## Locked since founding (no longer deferred)

- **Name + positioning + design** — LOCKED: name **Caisson** (ADR-0041); hero = **compliance
  wedge under a production-rigor umbrella** (ADR-0040); design foundation palette+type (ADR-0042),
  **expanded** into a full brand system (mark · icons · illustration · expressive motion · elevation+glow)
  by **ADR-0078** (supersedes 0042). Site SEO → **ADR-0079**; copy laws → **ADR-0080** (extends specs/04).
  The old "AI production codebase starter" frame is superseded.
- **Module production-standards + pipeline** — LOCKED: manifest · publish flow · lint gates ·
  commercial **editions** (ADR-0020-0023, **all four editions commercial** — Local-first's AGPL
  flank removed by **ADR-0083**); `tooling/`+`registry/` is the seam. **Open-core amendment (ADR-0094,
  2026-06-29):** the **Base substrate** (kernel·auth·tenancy-rls·ui·billing·jobs·email·ai-config·
  mcp-server) is now **Apache-2.0**; editions + field-crypto + audit-worm + registry-service + updates
  stay commercial. Re-licensing is **DONE in code** (work item W1, ADR-0094 + **ADR-0097**):
  the open registry contract split into Apache-2.0 `@caisson/registry-schema` (the commercial
  `@caisson/registry` service re-exports it); 15 base pkgs flipped to Apache-2.0/oss (the open set is **16** since ADR-0412 named `ds-manifest`) + Apache `LICENSE`
  files (ADR-0136 added cli·migrate·license-verify — incl. the generator — to the open Base set); the
  standards-gate enforces the license split + the open↔commercial no-depend-up boundary.
  Remaining W1 tail: `apps/site` licensing copy (design track owns that tree).
- **Site go-live posture** — LOCKED (**ADR-0082**, amended by **ADR-0237 rider 2**): the site reads
  **live self-serve** (purchase CTAs, no waitlist), **committed prices** (no
  "indicative/subject-to-change" frame — supersedes ADR-0081), **artifacts true-to-built** as the
  floor, and — per 0237 rider 2 — **FULL V1-live posture**: no roadmap labels, no "coming soon", no
  future framing anywhere; the old Agentic-Dev labeled-roadmap exception is RETIRED. Real checkout +
  EULA have since shipped.

## Still open (do NOT pre-bind)

- _Nothing._ The last standing item — **Pricing FINAL adjustments** — closed 2026-08-09:
  **ADR-0403 locks Compliance at $1,649 FINAL** (the operative ADR-0386 number) and closes the
  adjustment window; any future price change is a superseding ADR, not an adjustment.
  Grandfathering would ride that future ADR.

_Closed since: **app framework** → Next.js App Router (ADR-0044); **hosting/site deploy mode** →
one dynamic Next 16 `standalone` app (marketing + docs + buyer dashboard, Fumadocs MDX kept) on
**Railway**, superseding the ADR-0084 static-export-to-Cloudflare-Pages mode (ADR-0114/0115,
2026-06-30). **DEPLOYED 2026-07-01** — all services LIVE on Railway (caisson.sh/www/admin/license +
docs + support-bot + SigNoz — SigNoz removed same day, replaced by Grafana Cloud, ADR-0177), DNS
cut over to Railway, and the Cloudflare Pages project torn down._

## Commits

Conventional commits, atomic, one logical change each. Scopes: `scaffold` `specs` `adr` `state`
`kickoffs` `tooling` `kernel` — plus the per-package scopes: `auth` `tenancy-rls`
`billing` `credits` `ai-config` `mcp` `ui` `audit-worm` `field-crypto` `compliance` `ai-kit`
`local-ai` `agent-dev` `cli` `support-bot` `license` `docs` `site` (the `apps/site` marketing+docs app)
`demos` (the `apps/demos` interactive demo surface, ADR-0400)
— plus the Stage-2 additions: `admin` (`apps/admin` control-plane) `alerting` `retention-runner`
`tool-exec` `audit-harness` `observability` `platform-reads` `migrate` `pricebook` — plus `security`
(the repo-local `tools/security/` + `docs/security/` stack, ADR-0314).

## PR review gate (in-session SHIP audits — Greptile RETIRED 2026-07-06)

**Greptile and the path-scoped `greptile-gate` check are RETIRED** (2026-07-06: the Starter plan's
monthly review limit hit mid-PR-#128 and the operator dropped the vendor — no upgrade, no
replacement external reviewer). `.github/workflows/greptile-gate.yml` and `.greptile/` are
deleted; the `/greptile` skill and `@greptileai` mentions no longer function against this repo.
The review gate is the **in-session SHIP audit lane** per gridwork doctrine: `gw-code-reviewer`
(opus) + `gw-security-auditor` (fable on the money/license seams this repo is full of) run against
the branch diff before the PR opens, findings adversarially verified and fixed in-session — the
lane that caught and fixed 12 findings on PR #128, including three P1 money bugs. R359 adds the
stable `runtime-images-gate` aggregate to release readiness; every runtime matrix member must succeed.
CI required
checks: `runtime-images-gate` · `check` · `standards-gate` · `registry-index` · `oscal-conformance` · `deterministic`
(the pinned security-scan gate, ADR-0327/CAISSON-95) · `support-bot` (the Python gate, promoted out
of advisory by ADR-0414 and unconditional since) (convention:
the private free-plan repo has no enforced branch protection, so "required" is discipline, not a
GitHub gate). History: the gate's design lives in git (PRs #51/#60) and the retired
`greptile-gate.yml` is recoverable from history if a future external reviewer is wired.

## Issue tracking (Linear)

Caisson uses **Linear** (Business tier) for execution tracking + inbound triage via the `linear` MCP.
**The boundary is binding: Linear owns WORK, git owns DECISIONS.** Full design + operating manual:
`docs/state/linear-integration.md` (ADR-0177 / PF-3).

- **Never lock a decision in Linear.** ADRs (`knowledge/decisions/`) + `decisions-and-forks.md` stay the
  git-native decision SOT. A Linear issue may _reference_ an ADR/fork by id; it never replaces one.
- Create/update issues via the `linear` MCP (`save_issue`/`save_project`/`list_issues`) in team `Caisson`
  (key `CAISSON`), project = area (Platform & Infra · Site & Buyer Dashboard · Editions & Registry ·
  Support & Docs). Put the runbook/context in the description; reference the ADR + link the PR.
- Use the issue's `gitBranchName` for the feature branch → auto-links the PR (Code Intelligence). Move
  status In Progress → In Review → Done across EXECUTE→SHIP; the decision still lands as an ADR/commit.
- **Delegate** a first-pass (scope/triage) to the built-in **Linear Agent**; the human stays owner and
  Claude Code does the real in-repo build. Don't mirror the whole fork board into Linear — only work items.

## Subagent model routing (binding)

Never default a subagent to Fable 5 — set `model` explicitly on every dispatch (Agent tool
`model`, Workflow `agent()` `opts.model`). The full lane table is canonical in gridwork-core
`identity/doctrine.md` (Model-routing lanes — promoted from this file 2026-07-02; gw agents
now also carry a harness-read `model:` frontmatter baseline). Caisson-specific note: fable
is for the crypto/money/license seams this repo is full of — never for fan-out.

## Agents, skills, tools — the caisson lens (2026-07-02)

The agent roster, skills, and MCPs are GLOBAL (owned by gridwork-core, linked via `~/.claude`)
— this section is the caisson-relevant subset + bindings, NOT a second registry. Canonical:
roster `gridwork-core claude/agents/INDEX.md` · skills = `/<name>` slash commands
(`claude/playbooks/user-triggered/`) · MCP pick-table `identity/mcps.md` · everything else
routes via `identity/index.md`.

**Agents that carry caisson's recurring jobs** (dispatch with explicit `model`; all sonnet lane):

| Agent                    | Cadence / trigger                | Job                                                                                                           |
| ------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `gw-product-insights`    | per-release / monthly            | PostHog (caisson-prod, id 493539) + Cookiy + GitHub issues + Linear → ranked priorities + draft Linear issues |
| `gw-aeo-strategist`      | per-launch + quarterly           | do LLMs cite caisson; llms.txt / robots / schema.org fixes                                                    |
| `gw-pricing-analyst`     | quarterly + per-edition          | competitor scrape + checkout funnel + WTP memo; never sets a price                                            |
| `gw-persona-walkthrough` | before landing/checkout ships    | per-scroll conversion-psych critique → hands to gw-frontend-designer                                          |
| `gw-devrel-writer`       | per-release                      | launch post / changelog / tutorial drafts, diff-grounded; operator publishes                                  |
| `gw-market-intel`        | monthly + competitor events      | category/competitor watch → cited briefing + draft Linear tickets                                             |
| `gw-gtm-copywriter`      | per comparison page / case study | claims scraped + dated, PAL-challenged; stops at a committed branch                                           |

Engineering lanes (`gw-typescript-pro`, `gw-code-reviewer`, `gw-security-auditor`,
`gw-test-automator`, …) route per `identity/doctrine.md` — nothing caisson-specific.

**Caisson-specific tool bindings:**

- **PostHog MCP** → project `caisson-prod` (US Cloud) — state it per dispatch, never assume carry-over.
- **Linear MCP** → work items only (Linear owns WORK, git owns DECISIONS — §Issue tracking above).
- **Cookiy MCP** → screeners / synthetic-persona tests / survey research; positioning research only, no PII.
- **CI** → every Linux job runs on `blacksmith-4vcpu-ubuntu-2404` (Blacksmith VM-per-job,
  ADR-0326; ADR-0365 moved release-train, publish, and mirror-sync off the retired credential-job
  carve, and deploy-railway is on Blacksmith too). Only quality's macOS leg stays
  `[self-hosted, gw-macos-arm64]`; `oscal-conformance` is self-contained on Blacksmith and installs
  its own JDK + oscal-cli per run. Review gate = the
  in-session SHIP audit lane (§PR review gate above — Greptile retired 2026-07-06).
- **GLM engine lane** (`gw engine glm "<task>"`) → bounded mechanical work on the z.ai subscription;
  sandboxed throwaway worktree, no secrets/MCPs, returns a diff — main thread owns git/PR.

## Relationship to gridwork-core

Global `~/CLAUDE.md` + the five auto-loaded gridwork rules apply. This file is additive.
Seeds are rebuilt clean from: gridwork-core, gridwork, gridworkdigital, Wardfile, tessera,
health-service, prospector. Provenance: `outputs/research/` (corpus + research + decisions —
the `library-research/` working dir was consolidated here, then deleted).

## GridWork fleet graph rails

Code-structure questions: graph first, grep last.

- **Fleet knowledge graph** (pushed origin/main, all 14 repos): the `graphify` MCP —
  `search` with `mode="dense"` (default; right for questions/descriptions) or
  `mode="lexical"` (exact symbol/filename/path only). Never `rerank`/`hybrid`
  (refuted vs dense on the live index, 2026-08-20). Node ids are `<repo>::`-prefixed;
  single-repo questions pass `repo="<repo>"`. The graph is already built (rebuilt every
  15 min from origin/main) — one tool call, no build step.
- **Live branch / uncommitted structure**: the `codebase-memory` MCP (`trace_path`,
  `query_graph`, `search_graph`) — local branches and worktrees are invisible to the
  fleet graph.
- **Grep/Read are for literal text**, not structure (callers, dependents, symbol paths).

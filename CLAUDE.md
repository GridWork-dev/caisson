# CLAUDE.md — Caisson working rules

Additive to the global gridwork-core surface (security floor, retrieval doctrine, coding
discipline auto-load from there). This file holds only what is specific to this repo.

**What this repo is:** a productized monorepo library — a composable base + four premium
editions (Compliance · AI Production Kit · Local-first AI · Agentic-Dev) + a `create-caisson`
generator + a custom support service. Sold one-time + bundle + per-module + subscription/credits.
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
2. `knowledge/decisions/` — the ADRs themselves (**0001–0093**: 0001–0024 founding+substrate+pipeline · 0040–0044 brand+crypto+framework · 0045–0049 Wave-0 substrate · 0050–0077 Wave-1 editions · 0078–0083 design+go-live · 0084–0088 GTM+collision-fix · 0089–0093 picker-round locks (billing-X2/migrate/mig-bundle/bin/local-debit); append-only, all locked). Canonical ADR catalog: `docs/adr-index.md`
3. `specs/` — locked concept docs; `specs/00-product-spec.md` is the founding spec
4. `plan.md` / `SUMMARY.md` — build plan + consolidated summary
5. `outputs/` — session artifacts (kickoffs, research, syntheses)

On conflict, the higher item wins.

## Cadence (spec-first)

Research → spec → ADR lock → code. **No product code before the spec/ADR it implements is
locked.** Current state: **P0 foundations + P1 base substrate SHIPPED; Wave-0 substrate + Wave-1
editions (merged-but-partial) + P5 generator (PR#12 merged) built; registry Worker LIVE.**
P6 (`services/{license,support-bot,docs}`) is the single pending phase. Live per-package
truth: `docs/build-state.md`.

## Engineering invariants (locked, ADR-0002 — apply to all product code)

- **TypeScript strict**, Bun runtime/PM (never npm/yarn). **Zod `.strict()` at every boundary.**
  No `any`, no `console.log` in product code. `crypto.randomUUID()` for IDs.
- **Credits/money are integer units** — never floats (ADR-0007).
- **Append-only versions** — locked artifacts immutable; amendments supersede (ADR-0006).
- **`fetchWithTimeout` on every outbound fetch; `crypto.timingSafeEqual` for every secret/token/
  license compare.** Fail-closed RLS (ADR-0005), credit gates (402), license checks.
- **One standards gate:** `tooling/` is the single eslint/tsconfig/test source; a package ships
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
  fully-commercial licensing (ADR-0020-0023, **all four editions commercial** — Local-first's AGPL
  flank removed by **ADR-0083**); `tooling/`+`registry/` is the seam.
- **Site go-live posture** — LOCKED (**ADR-0082**): the site reads **live self-serve** (purchase CTAs,
  no waitlist), **committed prices** (no "indicative/subject-to-change" frame — supersedes ADR-0081),
  **artifacts true-to-built** (no fabricated CLI/CI for the unbuilt editions); Agentic-Dev the one
  labeled-roadmap exception. Real checkout + EULA drafting are tracked fast-follows.

## Still open (do NOT pre-bind)

- **Pricing FINAL adjustments** (anchors in ADR-0012, displayed point-values committed by ADR-0082) —
  the operator may still adjust a number before checkout goes live, but the site no longer **says** so;
  grandfathering policy stays operator-owned. The display fork is closed.

_Closed since: **app framework** → Next.js App Router (ADR-0044); **hosting/site** → Cloudflare
Pages + `caisson.sh` + a single static-export Next 16 app with Fumadocs MDX (ADR-0084), built in
`apps/site` (marketing + docs)._

## Commits

Conventional commits, atomic, one logical change each. Scopes: `scaffold` `specs` `adr` `state`
`kickoffs` `tooling` `kernel` — plus the per-package scopes: `auth` `tenancy-rls`
`billing` `credits` `ai-config` `mcp` `ui` `audit-worm` `field-crypto` `compliance` `ai-kit`
`local-ai` `agent-dev` `cli` `support-bot` `license` `docs` `site` (the `apps/site` marketing+docs app).

## Relationship to gridwork-core

Global `~/CLAUDE.md` + the five auto-loaded gridwork rules apply. This file is additive.
Seeds are rebuilt clean from: gridwork-core, gridwork, gridworkdigital, Wardfile, tessera,
health-service, prospector. Provenance: `outputs/research/` (corpus + research + decisions —
the `library-research/` working dir was consolidated here, then deleted).

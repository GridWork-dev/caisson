# CLAUDE.md — stack (working name) working rules

Additive to the global gridwork-core surface (security floor, retrieval doctrine, coding
discipline auto-load from there). This file holds only what is specific to this repo.

**What this repo is:** a productized monorepo library — a composable base + four premium
editions (Compliance · AI Production Kit · Local-first AI · Agentic-Dev) + a `create-stack`
generator + a custom support service. Sold one-time + bundle + per-module + subscription/credits.
Full founding spec: `specs/00-product-spec.md`. Built **rebuild-clean** from proven GridWork
repos — never a port. **Working name only — real name + positioning are a deferred session.**

## The one operator rule

**Never auto-decide a fork.** Every open decision lives in `docs/state/decisions-and-forks.md`
until the operator locks it; recommendations are labeled with confidence + evidence, then wait.
Locks are recorded as ADRs in `knowledge/decisions/` (append-only, `ADR-NNNN-slug.md`, never
edited — supersede with a later ADR).

## Source-of-truth hierarchy

1. `docs/state/decisions-and-forks.md` — live board (locked + open)
2. `knowledge/decisions/` — the ADRs themselves (ADR-0001..0012 locked at Gate 4)
3. `specs/` — locked concept docs; `specs/00-product-spec.md` is the founding spec
4. `plan.md` / `SUMMARY.md` — build plan + consolidated summary
5. `outputs/` — session artifacts (kickoffs, research, syntheses)

On conflict, the higher item wins.

## Cadence (spec-first)

Research → spec → ADR lock → code. **No product code before the spec/ADR it implements is
locked.** Current state: **structure scaffolded, NO feature code yet** (this was a base-structure
session). Build proceeds per `plan.md` (P0 → P7) only after the relevant kickoff.

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

## Deferred sessions (do NOT pre-bind)

- **Positioning / hero / voice / name / branding** — a dedicated session (research best hero
  across all differentiators, not AI-only). "AI production codebase starter" is provisional.
- **Module production-standards + item pipeline** — a dedicated session; `tooling/`+`registry/`
  is the seam.

## Commits

Conventional commits, atomic, one logical change each. Scopes: `scaffold` `specs` `adr` `state`
`kickoffs` `tooling` `kernel` — plus, once code starts, per-package: `auth` `tenancy-rls`
`billing` `credits` `ai-config` `mcp` `ui` `audit-worm` `field-crypto` `compliance` `ai-kit`
`local-ai` `agent-dev` `cli` `support-bot` `license` `docs`.

## Relationship to gridwork-core

Global `~/CLAUDE.md` + the five auto-loaded gridwork rules apply. This file is additive.
Seeds are rebuilt clean from: gridwork-core, gridwork, gridworkdigital, Wardfile, tessera,
health-service, prospector. Provenance: `outputs/research/` (corpus + research + decisions —
the `library-research/` working dir was consolidated here, then deleted).

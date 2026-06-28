# Caisson

**Compliance-grade infrastructure for regulated SaaS.** `@caisson/*` · [caisson.sh](https://caisson.sh)

A productized **monorepo library**: a composable base + four premium editions + a generator
the buyer's AI agent drives + a custom AI support service. Sold as whole editions (one-time),
a bundle, **per-module à-la-carte**, and a **subscription/credits** layer.

> **Status:** the **base substrate is built + tested** (kernel · tenancy-rls · field-crypto · auth ·
> billing · credits) and **`create-caisson`** works. Edition packages have **merged, tested vertical
> slices** (single composition leg each, golden-file fixtures) but are **not yet feature-complete**;
> Agentic-Dev is a **roadmap** edition. Built **rebuild-clean** from proven GridWork repos (never a
> port). Founding spec: `specs/00-product-spec.md`. Live build status: `docs/build-state.md`
> (per-phase + per-package); decisions: `docs/state/decisions-and-forks.md` + `ADR-0082` §3.

## The offer

| Edition               | What                                                                                     | License                     |
| --------------------- | ---------------------------------------------------------------------------------------- | --------------------------- |
| **Compliance** (hero) | RLS + WORM + audit-chain + field-crypto + SOC2/HIPAA evidence pack                       | commercial                  |
| **AI Production Kit** | provider-agnostic AI config + metering + spend-caps + eval/CI + guardrails + agent-setup | commercial                  |
| **Local-first AI**    | compute seam + sqlite-vec + offline license                                              | commercial                  |
| **Agentic-Dev**       | governed-agent kernel (also powers the generator + buyer MCP) — roadmap                  | commercial                  |
| **Base**              | auth + fail-closed RLS + billing + credits + design floor + buyer MCP (auth) + AGENTS.md | commercial (core + modules) |

Licensing is **fully commercial** (`LicenseRef-Caisson-Commercial`); the AGPL Local-first flank was
removed (ADR-0083, reaffirms ADR-0050). No free or copyleft tier anywhere.

## Build status

What is actually on disk (verify against `packages/*/src` + `*.test.ts`; canonical posture in ADR-0082 §3).

| Layer              | Packages (`packages/*`)                                                                                                                                                                                 | State                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Substrate (proven) | kernel · tenancy-rls · field-crypto · auth · billing · credits                                                                                                                                          | built + tested                                                              |
| Generator          | cli (`create-caisson`)                                                                                                                                                                                  | built + tested                                                              |
| Edition packages   | Compliance (audit-worm · compliance) · AI-Kit (ai-config · ai-kit · ai-meter · prompt-registry · ai-evals · guardrails) · Local-first (local-ai · local-store) · Agentic-Dev (agent-kernel · agent-dev) | merged, tested vertical slices; NOT feature-complete. Agentic-Dev = roadmap |
| Base + shared      | mcp-server · license-verify · email · jobs · ui                                                                                                                                                         | partial / scaffolded                                                        |

## Layout

```
tooling/      # the one standards gate (eslint/tsconfig/testing)
packages/     # 24 packages: kernel + base substrate + edition packages + cli (each independently sellable)
registry/     # versioned module sources the generator + buyer's agent pull from
apps/         # 7 apps: 5 Next.js (ADR-0044) — site (marketing+docs) · studio · compliance/ai-kit/local-ai reference; base + agent-dev = plain-TS consumers
services/     # support-bot (Python) · license · docs
specs/        # locked concept set: 00 founding · 01 architecture · 02 core-loop · 03 design · 04 voice-and-brand
plan.md       # P0–P7 build plan
knowledge/decisions/   # ADRs 0001–0088 (gaps exist; numbering map in docs/state/decisions-and-forks.md)
docs/state/   # decisions-and-forks live board
outputs/kickoffs/      # kickoff docs for future sessions
SUMMARY.md    # consolidated summary of how we got here
```

## Build

Bun + Turborepo + changesets. `bun run check` (build + lint + test). Build proceeds per
`plan.md` only after the relevant kickoff (see `outputs/kickoffs/`).

## Locked vs open

**Locked:** name **Caisson** + hero (compliance wedge) + design foundation · module
production-standards pipeline + fully-commercial licensing · **app framework = Next.js** (ADR-0044) ·
**pricing display** = committed anchors, no "subject to change" (ADR-0082) · Cloudflare Pages hosting
on `caisson.sh` · docs = single Next site + MDX. **Open (operator-owned):** only the **final pricing-number
adjustment** + grandfathering policy before checkout goes live (the X-2 commerce wiring gap). See
`docs/state/decisions-and-forks.md`.

---

**Internal source-of-truth** (contributors + operator): start at the live board
`docs/state/decisions-and-forks.md` (CLAUDE.md SoT #1); ADRs in `knowledge/decisions/`; concept specs
in `specs/`. On conflict the higher item wins, per `CLAUDE.md`.

# Caisson

**Compliance-grade infrastructure for regulated SaaS.** `@caisson-sh/*` · [caisson.sh](https://caisson.sh)

A productized **monorepo library**: a composable base + six commercial bundles (Compliance ·
AI-Production · Local-first · Agentic-Dev · Provenance · Everything) + a generator the buyer's
AI agent drives + a custom AI support service. Sold as whole bundles (one-time), per-module
à-la-carte, and a **subscription/credits** layer.

> **Status:** SHIPPED and LIVE — base substrate + all six bundles + `create-caisson` + the registry
> Worker (registry.caisson.sh) + the full Railway fleet (site · admin · license · docs-RAG ·
> support-bot) + the local intel daemon, on Paddle SANDBOX commerce. Built **rebuild-clean** from
> proven GridWork repos (never a port). Founding spec: `specs/00-product-spec.md`. Live build
> status: `docs/build-state.md` (per-phase + per-package); decisions:
> `docs/state/decisions-and-forks.md`.

## The offer

| Bundle                | What                                                                                      | Price  | License                              |
| --------------------- | ----------------------------------------------------------------------------------------- | ------ | ------------------------------------ |
| **Compliance** (hero) | RLS + WORM + audit-chain + field-crypto + SOC2/HIPAA/EU-AI-Act evidence + OSCAL           | $1,649 | commercial                           |
| **AI-Production**     | metered `infer()` gateway + spend-caps + credits + eval/CI + guardrails + prompt registry | $739   | commercial                           |
| **Local-first**       | compute seam + sqlite-vec ANN + offline license + two-way sync + privacy gate             | $629   | commercial                           |
| **Agentic-Dev**       | governed-agent kernel + tool-exec gate (also powers the generator + buyer MCP)            | $329   | commercial                           |
| **Provenance**        | detached signing + append-only WORM audit chain + per-tenant field encryption             | $399   | commercial                           |
| **Everything**        | every bundle + every à-la-carte module, one purchase                                      | $2,259 | commercial                           |
| **Base**              | auth + fail-closed RLS + billing + design floor + buyer MCP (auth) + AGENTS.md            | free   | Apache-2.0 core + commercial modules |

Licensing is **open-core**: the Base set is 16 Apache-2.0 packages (kernel, auth, tenancy-rls, ui,
billing, jobs, email, ai-config, mcp-server, registry-schema, observability, cli, migrate,
rate-limit, license-verify, ds-manifest); bundles + à-la-carte modules + pricebook stay commercial
(`LicenseRef-Caisson-Commercial`). The AGPL Local-first flank was removed (ADR-0083, reaffirms
ADR-0050); the permissive open tier is Apache-2.0, not copyleft. Full catalog + pricing detail:
`docs/state/package-catalog.md`.

## Build status

What is actually on disk (verify against `packages/*/src` + `*.test.ts`; live per-package truth in
`docs/build-state.md`).

| Layer           | Packages (`packages/*`)                                                                                                                    | State          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| Substrate       | kernel · tenancy-rls · field-crypto · auth · billing · credits                                                                             | built + tested |
| Generator       | cli (`create-caisson`)                                                                                                                     | built + tested |
| Bundle packages | Compliance · AI-Production · Local-first · Agentic-Dev · Provenance · Everything (58 packages total — see `docs/state/package-catalog.md`) | shipped + live |
| Base + shared   | mcp-server · license-verify · email · jobs · ui                                                                                            | built          |

## Layout

```
tooling/      # the one standards gate (lint-policy/tsconfig/testing)
packages/     # 58 packages: kernel + base substrate + bundle packages + shared/harvest packages + cli
registry/     # versioned module sources the generator + buyer's agent pull from
apps/         # 7 apps: 5 Next.js (ADR-0044) — site (marketing+docs) · admin (control-plane, absorbed studio) · compliance/ai-kit/local-ai reference; base + agent-dev = plain-TS consumers
services/     # support-bot (Python) · license · docs · intel · betterstack-adapter
specs/        # locked concept set: 00 founding · 01 architecture · 02 core-loop · 03 design · 04 voice-and-brand
knowledge/decisions/   # ADRs (live catalog + ceiling in docs/adr-index.md; gaps exist)
docs/state/   # decisions-and-forks live board
outputs/kickoffs/      # kickoff docs for future sessions
```

## Build

Bun + Turborepo + changesets. `bun run check` (build + lint + test). Live build/deploy truth:
`docs/build-state.md` (per-package) and `docs/deploy/STATE.md` (deploy log); ongoing work:
`docs/state/outstanding-work.md`.

## Locked vs open

**Locked:** name **Caisson** + hero (compliance wedge) + design foundation · module
production-standards pipeline + open-core licensing (17-package Apache-2.0 base substrate +
commercial bundles/modules, ADR-0136/0287) · **app framework = Next.js** (ADR-0044) ·
**pricing display** = committed anchors, no "subject to change" (ADR-0082) · Railway hosting
on `caisson.sh` (ADR-0114/0115, superseding the original Cloudflare Pages plan) · docs = single Next
site + MDX · **pricing FINAL** — the adjustment window closed 2026-08-09 (ADR-0403 locks Compliance
at $1,649). **Open (operator-owned):** no product forks — what remains is the launch ladder itself
(Paddle production account, legal instruments, launch gates), consolidated in
`docs/state/operator-surface.md`. See `docs/state/decisions-and-forks.md` for the fork board.

---

**Internal source-of-truth** (contributors + operator): start at the live board
`docs/state/decisions-and-forks.md` (CLAUDE.md SoT #1); ADRs in `knowledge/decisions/`; concept specs
in `specs/`. On conflict the higher item wins, per `CLAUDE.md`.

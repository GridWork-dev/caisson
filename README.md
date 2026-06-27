# stack (working name — real name + positioning are a deferred session)

A productized **monorepo library**: a composable base + four premium editions + a generator
the buyer's AI agent drives + a custom AI support service. Sold as whole editions (one-time),
a bundle, **per-module à-la-carte**, and a **subscription/credits** layer.

> **Status:** base structure scaffolded — **no feature code yet**. Built **rebuild-clean** from
> proven GridWork repos (never a port). Founding spec: `specs/00-product-spec.md`.

## The offer

| Edition               | What                                                                                     | OSS/paid                |
| --------------------- | ---------------------------------------------------------------------------------------- | ----------------------- |
| **Compliance** (hero) | RLS + WORM + audit-chain + field-crypto + SOC2/HIPAA evidence pack                       | paid                    |
| **AI Production Kit** | provider-agnostic AI config + metering + spend-caps + eval/CI + guardrails + agent-setup | paid                    |
| **Local-first AI**    | compute seam + sqlite-vec + offline license                                              | AGPL open-core          |
| **Agentic-Dev**       | governed-agent kernel (also powers the generator + buyer MCP)                            | paid                    |
| **Base**              | auth + fail-closed RLS + billing + credits + design floor + buyer MCP (auth) + AGENTS.md | OSS core + paid modules |

## Layout

```
tooling/      # the one standards gate (eslint/tsconfig/testing)
packages/     # kernel + base packages + edition packages + cli (each independently sellable)
registry/     # versioned module sources the generator + buyer's agent pull from
apps/         # one reference app per edition (framework deferred)
services/     # support-bot (Python) · license · docs
specs/        # the locked spec set (00 founding · 01 architecture · 02 core-loop · 03 design)
plan.md       # P0–P7 build plan
knowledge/decisions/   # ADR-0001..0012 (locked at Gate 4)
docs/state/   # decisions-and-forks live board
outputs/kickoffs/      # kickoff docs for future sessions
SUMMARY.md    # consolidated summary of how we got here
```

## Build

Bun + Turborepo + changesets. `bun run check` (build + lint + test). Build proceeds per
`plan.md` only after the relevant kickoff (see `outputs/kickoffs/`).

## What's deferred (not locked)

Positioning / hero / voice / name · module production-standards pipeline · pricing numbers ·
docs tooling. See `docs/state/decisions-and-forks.md`.

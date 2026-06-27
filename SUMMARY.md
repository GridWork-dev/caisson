# SUMMARY — capability corpus → market → scoped library

Clean consolidation of the whole job (2026-06-27). Full detail in the per-phase artifacts
(see index). Gates 1–4 cleared; scaffold (Phase 6) next.

## What we did

| Phase                 | Output                                                                                                                                                                          | Result                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Capability mining | mined 15 repos (14 lab + cloned media-pipeline) → `capability-corpus.md`                                                                                                        | portfolio clusters into 5 capability areas; strongest = compliance (Wardfile) + local-first AI (tessera)                                  |
| 2 — Market research   | DataForSEO demand (reused prospector adapters) + Exa scan (6 angles) + 5 spine deep-dives + support research → `market-research.md`, `demand-signals.md`, `support-strategy.md` | compliance CPC 10–50× everything at low KD; generic boilerplate saturated/collapsing; recurring revenue = compliance-updates + AI-credits |
| 3 — Scope (picker)    | locks → `decisions-log.md` D13                                                                                                                                                  | monorepo · Option C · all-4-editions · compliance/SOC2-HIPAA lead · custom support-bot                                                    |
| 4 — Options           | 3 architectures → `options.md`                                                                                                                                                  | **Option C** picked (composable packages + generator/registry)                                                                            |
| 5 — Specs             | `specs/` + `plan.md` + 12 ADRs                                                                                                                                                  | features/architecture **locked** (Gate 4)                                                                                                 |

## LOCKED (features + architecture)

**Product:** a monorepo library — a **composable base** + **4 premium editions**, sold as whole
editions (one-time) + bundle + **per-module à-la-carte** + **subscription/credits**, with a
`create-stack` generator the buyer's AI agent drives + a custom AI support bot.

**Editions (all v1), each rebuilt clean from a proven repo:**

- **Compliance** (hero) ← Wardfile — RLS + WORM + audit-chain + field-crypto + SOC2/HIPAA evidence pack
- **AI Production Kit** ← gridwork + prospector + gridwork-core — provider-agnostic AI config + metering(PG-atomic) + spend-caps/circuit-breaker + eval/CI gate + guardrails + agent-assisted setup
- **Local-first AI** (AGPL open-core flank) ← tessera + health-service — compute seam + sqlite-vec + offline license
- **Agentic-Dev** ← gridwork-core — governed-agent kernel (also powers the generator + buyer MCP)
- **Base** ← gridwork + gwdigital + tessera — auth + fail-closed RLS + billing + credits + design floor + **buyer MCP (auth)** + AGENTS.md

**Key decisions (ADR-0001..0012):** Bun+Turborepo+changesets · TS-strict/Zod/integer-credits/one-standards-gate · composable packages (editions=compositions) · generator+registry+codegen-credits · fail-closed RLS · WORM+audit-chain+field-crypto · integer credit wallet/append-only ledger/402 · auth-gated buyer MCP · custom support-bot (Discord+Python RAG+hosted inference+cloud runners) · Ed25519 licensing + AGPL local-first + **pro-private firewall** · provider-agnostic AI config · pricing (one-time+bundle+per-module+subscription/credits).

**Build plan:** P0 foundations → P1 base → P2 compliance → P3 AI-kit → P4 local-first+agentic → P5 generator → P6 commerce+support+docs → P7+ round-out. Exit gate per phase, no dates.

## NOW LOCKED (positioning session 2026-06-27 — closes D14)

- **Name = Caisson** (`@caisson/*`, `caisson.sh`) · **hero = Compliance wedge under a
  production-rigor umbrella** · compliance-update subscription split into its own SKU · ICP
  buyer-firewall · EU AI Act = gated add-on · sequenced launch. Voice/tagline locked.
  → ADR-0013, ADR-0014, `specs/04-voice-and-brand.md`, decisions-log D18–D21.

## DEFERRED / OPEN (explicitly NOT locked)

- **Module production-standards + item pipeline** → a **separate dedicated session** (D9); P0 leaves the `tooling/`+`registry` seam.
- **Pricing numbers** = working anchors, refine pre-launch.
- **Docs tooling** (Mintlify vs self-host) → build-time ADR.

## Guardrails held throughout

Source repos read-only · all output in `library-research/` (+ the new scaffold) · **pro-private `media-pipeline` = patterns only, zero code in any deliverable** · every gate honored (converge → report → wait).

## Artifact index (`/home/gw/lab/library-research/`)

`MANIFEST.md` · `decisions-log.md` · `capability-corpus.md` · `raw-extractions.json` · `metrics.tsv`
· `market-research.md` · `demand-signals.md` · `demand-data.json` · `deep-dives.json` ·
`market-findings.json` · `scores.json` · `support-strategy.md` · `options.md` ·
`specs/{00-product-spec,01-architecture,02-core-loop-ux,03-design-framework}.md` · `plan.md` ·
`knowledge/decisions/ADR-0001..0012` · `sources/media-pipeline/` (cloned, firewalled).

## Next

Phase 6 — scaffold the monorepo (gridwork-core conventions + Wardfile layout), wire rebuild-clean
seams, stop at a **working scaffold + first compliance-edition skeleton**. Preceded by a
scaffold-fork picker (working name, stack, CLAUDE.md style, skeleton depth).

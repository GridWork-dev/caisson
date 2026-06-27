# SUMMARY — capability corpus → market → scoped library

Clean consolidation of the whole job (2026-06-27). Full detail in the per-phase artifacts
(see index). Gates 1–4 cleared; scaffold + P0/P1 build + reconcile **done** (below).

## Build state (post-reconcile, 2026-06-27)

Three parallel build tracks merged onto `main` via one integration pass + the full **Caisson**
rename:

- **P0 foundations** — `tooling/` standards gate + `kernel` + golden harness + CI.
- **P1 base substrate** — `auth · tenancy-rls · credits · billing · ai-config · mcp-server · ui ·
jobs · email` + `apps/base` reference (real-HTTP 402→grant→200→MCP loop).
- **D9 module pipeline** — manifest + registry schema + standards gate (AGPL/down-only/declarations)
  - import-boundary lint, **fully-commercial licensing** locked.
- **Brand** — name **Caisson** (`@caisson/*`, `caisson.sh`), compliance-wedge hero, design
  foundation (palette A + Structural type), studio decision-surface app.

ADR collisions across tracks reconciled (0013/0014/0023 → see decisions-log D22). `bun run check`
= 44/44 turbo tasks + standards gate green; turbo pinned `~2.5.x` (2.10 SIGBUS locally). Hosting =
Cloudflare Pages on `caisson.sh` (Terraform in `infra/`); docs = single Next site + MDX.

**Wave 0 (shared substrate, ADR-0045–0049)** built the floor under the parallel editions:
`@caisson/field-crypto` (per-tenant HKDF keys + AES-256-GCM + versioned envelope + Drizzle column +
KMS seam), the **registry runtime** (`ledger.jsonl` → CI-built `index.json` + byte-identical-rebuild
job + the static read path + an un-deployed Worker seam), the `@caisson/cli` generator skeleton
(allowlist gate + debit-before-spend meter seam), and the shared kernel primitives (SHA-256 audit
chain + append-only versioning). Wave-1 editions P2–P4, the full P5 generation/MCP drive, and
services (P6) remain.

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
`create-caisson` generator the buyer's AI agent drives + a custom AI support bot.

**Editions (all v1), each rebuilt clean from a proven repo:**

- **Compliance** (hero) ← Wardfile — RLS + WORM + audit-chain + field-crypto + SOC2/HIPAA evidence pack
- **AI Production Kit** ← gridwork + prospector + gridwork-core — provider-agnostic AI config + metering(PG-atomic) + spend-caps/circuit-breaker + eval/CI gate + guardrails + agent-assisted setup
- **Local-first AI** (AGPL open-core flank) ← tessera + health-service — compute seam + sqlite-vec + offline license
- **Agentic-Dev** ← gridwork-core — governed-agent kernel (also powers the generator + buyer MCP)
- **Base** ← gridwork + gwdigital + tessera — auth + fail-closed RLS + billing + credits + design floor + **buyer MCP (auth)** + AGENTS.md

**Key decisions (ADR-0001..0012):** Bun+Turborepo+changesets · TS-strict/Zod/integer-credits/one-standards-gate · composable packages (editions=compositions) · generator+registry+codegen-credits · fail-closed RLS · WORM+audit-chain+field-crypto · integer credit wallet/append-only ledger/402 · auth-gated buyer MCP · custom support-bot (Discord+Python RAG+hosted inference+cloud runners) · Ed25519 licensing + AGPL local-first + **pro-private firewall** · provider-agnostic AI config · pricing (one-time+bundle+per-module+subscription/credits).

**Build plan:** P0 foundations → P1 base → P2 compliance → P3 AI-kit → P4 local-first+agentic → P5 generator → P6 commerce+support+docs → P7+ round-out. Exit gate per phase, no dates.

## LOCKED since (was deferred)

- **Positioning / hero / voice / name / design** → **LOCKED** (ADR-0040 hero · ADR-0041 name **Caisson** · ADR-0042 design · `specs/04` voice). The old "AI production codebase starter" / "Forge" frame is superseded.
- **Module production-standards pipeline** → **LOCKED** (ADR-0020 manifest · ADR-0021 publish flow · ADR-0022 lint gates · ADR-0023 fully-commercial licensing; `tooling/standards-gate` + `registry/schema`).
- **Docs tooling + hosting** → **LOCKED** — single Next site + MDX, hosted on Cloudflare Pages (`caisson.sh` zone via Terraform in `infra/`).

## STILL OPEN (not locked)

- **Pricing numbers** = working anchors, refine pre-launch.
- **App framework per edition** — decided when each edition's app is built.

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

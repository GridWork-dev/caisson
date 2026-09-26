# Caisson — Product Spec & Phased Roadmap

> **2026-09-26 — open-source pivot ([ADR-0428](../knowledge/decisions/ADR-0428-open-source-pivot.md)).**
> Caisson is now free and open source under Apache-2.0, published as `@caisson-sh/*`, and nothing
> is sold. This founding spec is kept as written: its editions, pricing, licensing tiers, hosted
> services and go-to-market sections are historical. The packages and architecture it describes
> remain.

**Name:** Caisson · `@caisson/*` · `caisson.sh` (locked, ADR-0041 — was working name `stack`/`Forge`)
**Sources:** `capability-corpus.md` + `market-research.md` + `support-strategy.md` + scoping decisions (`decisions-log.md` D5–D14)
**Status:** Features + architecture **locked** (Gate 4). **Positioning / hero / voice / name now LOCKED** (positioning session, ADR-0040 + ADR-0041 + `specs/04-voice-and-brand.md`).
**Positioning (LOCKED, ADR-0040):** a **two-layer** frame — the **umbrella** is a production-grade codebase library, _the load-bearing infrastructure cheap boilerplates skip_; the **hero wedge** acquisition leads with is **Compliance** (highest WTP, cleanest unserved gap). AI Production Kit = #2, Local-first AI = the free AGPL flank, Agentic-Dev = post-wedge. Build scope (all four editions) is unchanged — positioning fixes only the GTM weight. The earlier "AI production codebase starter" frame was provisional scaffolding, now superseded.

---

## 0. Decisions locked in scoping (Phase 3 picker + operator direction)

| Dimension                                        | Decision                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture                                     | **Monorepo**, Option **C** — composable capability packages **+** a `create-caisson` generator/registry (codegen-credits)                                                                                                                                                                                           |
| v1 depth                                         | **FULL** — base + **all four editions** (Compliance · AI Production Kit · Local-first AI · Agentic-Dev)                                                                                                                                                                                                             |
| Lead edition                                     | **Compliance** — broad records base + **SOC2/HIPAA evidence-pack** kit first                                                                                                                                                                                                                                        |
| Generic boilerplate                              | Included as the **table-stakes base** (competes with ShipFast/MakerKit) but **framed under the differentiators**                                                                                                                                                                                                    |
| Commerce                                         | One-time editions + discounted bundle + **per-module à-la-carte** + **subscription/credits**                                                                                                                                                                                                                        |
| Support                                          | **Custom self-built** `support-bot` (Discord + Python LLM dispatch + codebase RAG + hosted inference on cloud runners)                                                                                                                                                                                              |
| Build philosophy                                 | **Rebuild clean** from proven strategies; **pro-private `media-pipeline` = patterns only, zero code**                                                                                                                                                                                                               |
| Module production standards                      | A **separate dedicated session** deep-dives module/item production standards + pipeline — specs leave the seam, don't pre-bind it                                                                                                                                                                                   |
| **Positioning / hero / voice / name / branding** | **LOCKED** (ADR-0040 + ADR-0041 + `specs/04`) — name **Caisson**; hero = **Compliance wedge under a production-rigor umbrella**; compliance-update subscription split into its own SKU; ICP buyer-firewall; EU AI Act = gated add-on module; sequenced launch (free local-first → compliance hero → AI-Kit/agentic) |

---

## 1. Product definition

**One-liner (positioning-led, ADR-0040):** Caisson is the **compliance-grade** base for regulated SaaS — fail-closed RLS, WORM, an append-only audit chain, and SOC2/HIPAA evidence packs, wired and tested from day one — and, under the same production-rigor roof, the editions for AI-production infra, local-first AI, and agentic dev. Your AI coding agent generates and configures the exact stack from a versioned registry, and a codebase-aware AI bot supports it. _The load-bearing infrastructure cheap boilerplates skip._

Caisson is a **monorepo of composable packages** sold three ways at once — whole editions (one-time), a discounted bundle, or **individual modules à la carte** — with an optional **subscription** that adds a monthly credit allotment, framework/compliance updates, and private-registry access. A `create-caisson` generator (driven by the buyer's own AI agent) assembles a tailored codebase from a versioned module registry; a shipped **MCP server (with auth)** lets the buyer's Claude Code / Cursor understand the codebase; a custom **AI support bot** answers in Discord grounded in the code and escalates to a tagged human ticket.

**The four substantive differentiators** (everything generic boilerplate ships is table stakes):

1. **Compliance-grade by default** — fail-closed RLS + S3 WORM Object-Lock + append-only SHA-256 audit chain + per-tenant field encryption + a SOC2/HIPAA evidence-pack generator. The market's #1 named gap: _"no turnkey full-stack compliance starter."_ Demand: compliance CPC 10–50× every other category.
2. **AI-production-grade, not AI-theater** — token metering with Postgres atomics, per-tenant spend caps + circuit breakers, an eval harness + CI gate, a versioned prompt registry, guardrails, and provider-agnostic AI config — the production-rigor layer every cheap AI boilerplate skips.
3. **Agent-native delivery** — a `create-caisson` generator + module registry the buyer's agent drives (codegen-credits), a shipped buyer-facing **MCP server with auth**, and AGENTS.md config bundles. Setup is agent-assisted (the "coach, not wizard" the market lacks).
4. **A support + value-add surface that compounds** — Discord moat + a custom codebase-RAG AI bot that briefs and tags humans into tickets, AI-searchable docs that double as the buyer's agent context, lifetime updates, and a credits/subscription layer that fixes the one-time "revenue dry spell."

**Explicit non-differentiators** (build to parity, never market as the edge): generic auth/Stripe/landing scaffolding (everyone ships it), raw template count, price undercutting, "AI-ready" badge with nothing behind it.

**Design law — composability + standards:** every capability is an independently sellable package built to one enforced standard (`tooling/`), so the base competes as a base _and_ any module sells à la carte _and_ editions compose without duplication. Anything that can't be cleanly packaged + standardized doesn't ship.

---

## 2. Personas (the buyers)

**B1 — The Compliance Builder (primary, hero edition).** A dev/founder/agency building a regulated-industry SaaS (SOC2/HIPAA/legal/fin-ops). Needs the RLS+WORM+audit+evidence layer that platforms (Vanta/Drata) sell as a finished product but nobody sells as a _framework_. High budget (compliance CPC 10–50×), values the picks-and-shovels, buys to skip 3 months of regulated-data plumbing.

**B2 — The AI-Product Engineer.** Shipping an AI feature/SaaS and hitting the production wall — billing, spend caps, eval, guardrails, prompt versioning. Buys the **AI Production Kit** for the rigor layer + provider-agnostic config + agent-assisted setup.

**B3 — The Local-first / Privacy Builder.** Building an on-device/offline AI app (regulated on-prem, privacy-first). Pulls the **Local-first AI** edition (open-core flank) for the compute seam + sqlite-vec + offline license; converts to paid for the license kit + hosted-inference credits.

**B4 — The Agentic Developer.** Wants the **Agentic-Dev** governed-agent kernel for their own Claude-Code-driven workflow. Narrower buyer; the kernel also underpins the generator + buyer MCP.

**B5 — The Agency / Reseller (multiplier).** Buys the bundle + white-label rights, builds client products on Caisson repeatedly. The seat/agency tier + per-module commerce serve them.

---

## 3. The core loop

The buyer's loop — the unit of quality:

1. **Choose** — browse editions/modules; buy a whole edition, the bundle, or individual modules. Card checkout via Merchant-of-Record.
2. **Access** — private GitHub repo / registry access granted on purchase (webhook → collaborator/registry token); license issued (Ed25519, offline-verifiable).
3. **Generate** — run `create-caisson` (or let the buyer's AI agent drive it via the MCP server): pick edition + modules → a tailored codebase is scaffolded from the versioned registry. Generation is **credit-metered**.
4. **Configure** — the AI Production Kit's provider-agnostic config + a settings file; the **agent walks setup** (env, providers, DB, deploy) — the coach-not-wizard onboarding.
5. **Ship** — the buyer builds their product on a base that's already production-grade (RLS, billing, credits, metering, guardrails, evidence) — passing CI gates that ship with it.
6. **Support + sustain** — AI support bot (Discord, codebase-RAG) answers + briefs/tags humans; AI-searchable docs; lifetime updates; optional subscription adds monthly credits + compliance-framework updates + private-registry pulls.

**Seller ops loop** (solo-operable): purchase → automated access/license grant → usage/credits metered → updates shipped via registry → support deflected by the AI bot → renewals driven by the subscription/credit layer. No per-customer manual step.

---

## 4. Editions & packaging (v1 — all four)

| Edition                              | Core packages                                                                                                                                               | Seeds (rebuild-clean)                                                  | OSS / paid                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------- |
| **Base** (substrate)                 | `auth` `tenancy-rls` `billing` `credits` `ai-config` `mcp-server` `ui` `jobs` `email` `kernel`                                                              | gridwork + gwdigital + tessera (design floor) + gridwork-core (kernel) | free/OSS core + paid pro modules          |
| **Compliance** (hero)                | `audit-worm` `field-crypto` `compliance` (RLS+WORM+audit-chain + SOC2/HIPAA evidence-pack + config-as-code module registry)                                 | Wardfile (+il-dbui)                                                    | paid                                      |
| **AI Production Kit**                | `ai-kit` (provider-agnostic config + token-metering[PG-atomic] + spend-caps/circuit-breaker + eval-harness/CI + prompt-registry + guardrails + agent-setup) | gridwork + prospector + gridwork-core                                  | paid (bundle + à-la-carte)                |
| **Local-first AI** (open-core flank) | `local-ai` (compute seam + privacy gate + sqlite-vec ANN + offline license + local store)                                                                   | tessera + health-service                                               | **AGPL open-core** + paid license/credits |
| **Agentic-Dev**                      | `agent-dev` (typed agent/skill/rule schema + lifecycle state machine + local hybrid memory + hooks dispatcher)                                              | gridwork-core                                                          | paid                                      |

**Generator (Option C):** `cli` (`create-caisson`) + `registry/` (versioned module sources the CLI + buyer's agent pull from). Generation metered as codegen-credits.

**Services:** `support-bot` (custom — see ADR-0009) · `license` (Ed25519 + MoR webhook + credit grants) · `docs` (AI-native, feeds bot + buyer agents).

### Pricing & packaging (working model — refine pre-launch)

- **Editions one-time:** Compliance $899–1,499 · AI Production Kit $399–699 · Local-first AI $349–599 · Agentic-Dev $349–599. (Anchored on Clynova compliance $999–1,999; generic $199–599.)
- **Bundle:** all editions + base ~$1,999–2,499 (own-the-code).
- **Per-module à-la-carte:** $49–199/module (auth/billing/credits/audit-worm/guardrails/etc.).
- **Subscription (the MRR fix):** $49–199/mo or annual — monthly credit allotment (codegen + AI-feature) + **compliance-framework updates** (the #1 retention lever) + private-registry pulls + priority support SLA + new-edition access. Grandfather buyers on price increases.
- **Open-core flank:** Local-first AI core AGPL (community/distribution); monetize the license kit + hosted-inference/GPU credits + pro modules.

---

## 5. Roadmap (phase-based, exit criteria, no dates)

- **P0 — Foundations.** Monorepo + `tooling/` standards (the ground-up coding strategy) + `kernel` + CI. Exit: a package builds, lints, tests, and the standards gate is green.
- **P1 — Base substrate.** auth → tenancy-rls → billing → credits → ai-config → mcp-server (w/ auth) → ui → jobs → email. Exit: a runnable base reference app ships with all base packages, fail-closed RLS, working credit wallet + buyer MCP.
- **P2 — Compliance edition (hero).** audit-worm → field-crypto → compliance (RLS+WORM+audit-chain + SOC2/HIPAA evidence-pack + module registry + golden-file harness). Exit: a compliance reference app emits a valid evidence pack against a golden fixture.
- **P3 — AI Production Kit.** provider-agnostic config + token-metering(PG-atomic) + spend-caps/circuit-breaker + eval-harness/CI + prompt-registry + guardrails + agent-setup. Exit: a metered AI feature with a passing eval gate + enforced spend cap.
- **P4 — Local-first AI + Agentic-Dev.** compute seam + sqlite-vec + offline license; the governed-agent kernel. Exit: a local-first reference app runs offline; the kernel drives a lifecycle act.
- **P5 — Generator + registry (Option C).** `create-caisson` CLI + versioned registry + agent-driven generation + codegen-credit metering. Exit: the buyer's agent generates a tailored repo from the registry, metered.
- **P6 — Commerce + support + docs.** MoR checkout + license/credit grants + the custom support-bot + AI-native docs. Exit: a real purchase grants access + license + credits; the bot answers from the codebase and escalates a tagged ticket.
- **P7+ — Round-out (roadmap).** compliance vertical packs (legal-doc, fin-ops, certified-payroll, EU-AI-Act), AI-feature packs, local-first verticals, the module marketplace.

> **Deferred to a dedicated session (D9):** the production standards + the per-module/item production pipeline. P0's `tooling/` seam is where it lands — specs here do not pre-bind it.

---

## 6. Standing risks (monitors, not gates)

- **Scope (all four editions in v1)** is large — P1/P2 must prove the package-composition model before P3/P4 fan out; if composition friction is high, narrow to Base+Compliance and scaffold the rest.
- **Generator maintenance (Option C)** is a product unto itself — keep it a thin layer over the registry; don't let it block P1–P4.
- **Compliance correctness** is legally load-bearing — golden-file regression before any evidence-pack logic; "flag, never guess" (inherit Wardfile invariant).
- **Open-core boundary** — AGPL local-first must not entangle paid editions; license boundary is an ADR.
- **Pro-private firewall** — nothing from `media-pipeline` seeds any package; patterns only.

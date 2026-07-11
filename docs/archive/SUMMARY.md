# SUMMARY — capability corpus → market → scoped library → built substrate

How-we-got-here narrative for Caisson (`@caisson/*`, `caisson.sh`). Consolidates the research →
spec → ADR → build arc through 2026-06-28. This file is the **history**, not the live state.

> **Live build status lives in `docs/build-state.md`** (current per-package truth). This file = how
> we got here; that file = where we are. Canonical decisions stay in `knowledge/decisions/` (ADRs) +
> `specs/`; the live fork board is `docs/state/decisions-and-forks.md`. On conflict the canonical
> sources win — see `CLAUDE.md` source-of-truth hierarchy.

## Where the build is (post Wave-1, 2026-06-28)

Research gates 1–5 cleared, then four build waves merged onto `main` (PRs #1–#11) plus the full
**Caisson** rename:

| Wave                        | Merged                     | What landed                                                                                                                                                                                                                                                                                 | Evidence                                                  |
| --------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **P0 foundations**          | PR #1                      | `tooling/` standards gate + `kernel` + golden harness + CI                                                                                                                                                                                                                                  | `tooling/{standards-gate,eslint-config,tsconfig,testing}` |
| **P1 base substrate**       | PR #1                      | `auth · tenancy-rls · credits · billing · ai-config · mcp-server · ui · jobs · email` + `apps/base` (real-HTTP 402→grant→200→MCP loop)                                                                                                                                                      | the packages + `apps/base`                                |
| **D9 module pipeline**      | PR #1                      | manifest + registry schema + standards gate (AGPL/down-only/declarations) + import-boundary lint; fully-commercial licensing locked                                                                                                                                                         | `registry/`, `tooling/standards-gate`                     |
| **Wave 0 shared substrate** | PR #2                      | `field-crypto` (per-tenant HKDF + AES-256-GCM + envelope + Drizzle column + KMS seam), registry runtime (`ledger.jsonl` → CI `index.json` + byte-identical rebuild + un-deployed Worker seam), `cli` generator skeleton, kernel primitives (SHA-256 audit chain + append-only versioning)   | `packages/{field-crypto,cli}`, `registry/`                |
| **GTM site**                | PR #3 / #6                 | `apps/site` (Next 16 + Fumadocs MDX, static → Cloudflare Pages); brand foundation + go-live copy                                                                                                                                                                                            | `apps/site`, `infra/terraform`                            |
| **Wave 1 editions**         | PR #11 (supersedes #5–#10) | all 4 editions + shared-base merged to one branch → `main`: `audit-worm · compliance · field-crypto(P2) · ai-kit · ai-meter · prompt-registry · ai-evals · guardrails · local-ai · local-store · agent-kernel · agent-dev · license-verify` + `apps/{compliance,ai-kit,local-ai,agent-dev}` | the edition packages                                      |

**Build-reality caveat (ADR-0082 §3, honesty boundary — do not overclaim):** only the **base
substrate** (`kernel · tenancy-rls · field-crypto · auth · billing · credits`) + **`create-caisson`**
(`cli`) are production-solid. The Wave-1 edition packages exist, **merged, and now carry real source +
tests** (e.g. `compliance` ~2.9k LOC / 11 tests, `local-ai` ~2.2k / 9, `audit-worm` ~1.3k / 6) — but
they are **merged-but-partial** against their P2–P6 exit gates, not finished products. Agentic-Dev
(`agent-dev`) is the most skeletal (roadmap edition). **Do not claim the editions are fully built.**
Per-package built-vs-stub truth → `docs/build-state.md`.

`bun run check` = turbo build·lint·unit·integration + standards gate + golden-file. Turbo pinned
`~2.5.x` (2.10 SIGBUS locally). Hosting = Cloudflare Pages on `caisson.sh` (Terraform in `infra/`).

## What we did (research gates 1–5)

| Gate                  | Output                                                                                                                                                                      | Result                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1 — Capability mining | mined 15 repos (14 lab + cloned media-pipeline) → `outputs/archive/research/capability-corpus.md`                                                                           | portfolio clusters into 5 capability areas; strongest = compliance (Wardfile) + local-first AI (tessera)                       |
| 2 — Market research   | DataForSEO demand (reused prospector adapters) + Exa scan + 5 spine deep-dives + support research → `outputs/research/{market-research,demand-signals,support-strategy}.md` | compliance CPC 10–50× everything at low KD; generic boilerplate saturated; recurring revenue = compliance-updates + AI-credits |
| 3 — Scope (picker)    | locks → `outputs/archive/research/decisions-log.md` D13                                                                                                                     | monorepo · Option C · all-4-editions · compliance/SOC2-HIPAA lead · custom support-bot                                         |
| 4 — Options           | 3 architectures → `outputs/research/options.md`                                                                                                                             | **Option C** picked (composable packages + generator/registry)                                                                 |
| 5 — Specs             | `specs/` + `plan.md` + ADR-0001..0012                                                                                                                                       | features/architecture **locked** (Gate 4)                                                                                      |

## LOCKED (features + architecture)

**Product:** a monorepo library — a **composable base** + **4 premium editions**, sold as whole
editions (one-time) + bundle + **per-module à-la-carte** + **subscription/credits**, with a
`create-caisson` generator the buyer's AI agent drives + a custom AI support bot.

**Editions (all v1), each rebuilt clean from a proven repo — all merged via Wave-1 (PR #11), partial
vs exit gates per the caveat above:**

- **Compliance** (hero) ← Wardfile — RLS + WORM + audit-chain + field-crypto + SOC2/HIPAA evidence pack
- **AI Production Kit** ← gridwork + prospector + gridwork-core — provider-agnostic AI config + metering (PG-atomic) + spend-caps/circuit-breaker + eval/CI gate + guardrails + agent-assisted setup
- **Local-first AI** ← tessera + health-service — compute seam + sqlite-vec + offline license. **Now fully commercial (ADR-0050/0083) — the AGPL open-core flank was killed.**
- **Agentic-Dev** ← gridwork-core — governed-agent kernel (also powers the generator + buyer MCP). **Roadmap edition (most skeletal).**
- **Base** ← gridwork + gwdigital + tessera — auth + fail-closed RLS + billing + credits + design floor + **buyer MCP (auth)** + AGENTS.md

**Canonical decisions:** ADRs `0001–0238` (gaps exist — `0025–0039` unused, `0119–0128` proposed-only; live catalog: `docs/adr-index.md`) in `knowledge/decisions/`. The full
numbering map + supersession chain is owned by `docs/state/decisions-and-forks.md` (do not duplicate
here). Founding set `ADR-0001..0012` covers Bun+Turborepo+changesets, TS-strict/Zod/integer-credits,
composable packages, generator+registry, fail-closed RLS, WORM+audit-chain+field-crypto, credit
wallet/402, auth-gated buyer MCP, support-bot, licensing+pro-private firewall, provider-agnostic AI
config, pricing.

**Build plan (`plan.md`):** P0 foundations → P1 base → P2 compliance → P3 AI-kit → P4 local-first +
agentic → P5 generator → P6 commerce + support + docs → P7+ round-out. **Done so far:** P0, P1, the
D9 pipeline, Wave 0 substrate, Wave 1 editions (merged-but-partial), GTM site, **P5 generator + registry
full drive** (shipped — PR#12 merged, security audit PASS; registry Worker now LIVE), and **P6 in
progress** — Bucket C (`services/docs` PR#23 + `services/support-bot` PR#24) + X-2 billing/entitlement
(PR#18) merged. **Remaining in P6:** license issuer + dashboards + publish-readiness. Exit gate per
phase, no dates.

## Specs (canonical concept docs — `specs/`)

| Spec                           | Owns                                                          |
| ------------------------------ | ------------------------------------------------------------- |
| `specs/00-product-spec.md`     | founding product spec (the whole job, §5 = build plan source) |
| `specs/01-architecture.md`     | composable-package architecture + base→edition boundary       |
| `specs/02-core-loop-ux.md`     | the buyer core-loop UX                                        |
| `specs/03-design-framework.md` | design framework                                              |
| `specs/04-voice-and-brand.md`  | voice + brand register (extended by ADR-0080)                 |

## LOCKED since founding (was deferred)

- **Positioning / hero / voice / name / design** → ADR-0040 hero (compliance wedge under a
  production-rigor umbrella) · ADR-0041 name **Caisson** · ADR-0042 design, **superseded/widened by
  ADR-0078** (brand-foundation expansion) · `specs/04` voice + ADR-0080 copy. The old "AI production
  codebase starter" / "Forge" frame is superseded.
- **Module production-standards pipeline** → ADR-0020 manifest · ADR-0021 publish flow · ADR-0022 lint
  gates · ADR-0023 fully-commercial licensing (`tooling/standards-gate` + `registry/schema`).
- **Docs + hosting** → single GTM site (`apps/site`, Next 16 + Fumadocs MDX, ADR-0084) on Cloudflare
  Pages (`caisson.sh` via Terraform in `infra/`).
- **Site go-live posture** → live self-serve checkout + committed pricing (ADR-0082); Local-first no
  longer free (ADR-0083).

## STILL OPEN (not locked — do NOT pre-bind)

- **Pricing numbers** — display fork CLOSED (ADR-0082 shows committed anchors), but any FINAL number
  adjustment before checkout + the grandfathering policy stay operator-owned (ADR-0012); deferred to
  P6/checkout. The **X-2 gap** (recurring billing cycle → `grant()` + USD↔credit price-book) is no
  longer undesigned: **built in B1** (PR#18, ADR-0089/0098 — `@caisson/pricebook` + `invoice.paid`→grant mapper in `services/license`).
- **App framework per edition** — standardized on Next.js App Router for reference apps (ADR-0044);
  any per-edition deviation decided when that app is built.

## Guardrails held throughout

Source repos read-only · **pro-private `media-pipeline` = patterns only, zero code in any
deliverable** · every research gate honored (converge → report → wait) · never auto-decide a fork
(`CLAUDE.md` operator rule).

## Artifact index (`outputs/research/`)

The old `library-research/` working dir (a prior local checkout) was consolidated into
`outputs/research/` then deleted — point here:

`MANIFEST.md` · `decisions-log.md` · `capability-corpus.md` · `raw-extractions.json` · `metrics.tsv` ·
`market-research.md` · `demand-signals.md` · `demand-data.json` · `deep-dives.json` ·
`market-findings.json` · `scores.json` · `support-strategy.md` · `options.md` · `wave1-forks.md` ·
`review-findings.json` · `demand-probe.ts` · `metrics.sh` · `design-session/`.

Specs → `specs/` (top-level). ADRs → `knowledge/decisions/ADR-0001..0137`. Build plan → `plan.md`.
Session kickoffs → `outputs/kickoffs/`. Per-phase SPEC/PLAN → `outputs/specs/`.

## Next

**~~P5 — Generator + registry full drive~~ SHIPPED** (PR#12 merged, security audit PASS; registry
Worker now LIVE at `caisson-registry.broken-wood-97a9.workers.dev`). Deferred to P6: publishability
flip (T2/T3), compose-time migration-bundle, `@caisson/migrate` promotion, MCP rate-limit.

**P6 — commerce + support + docs (partially shipped; the active phase).** `services/docs` (AI-native
corpus + `llms.txt` + Bearer `/query`, PR#23, ADR-0096) + `services/support-bot` (Discord RAG, PR#24,
ADR-0009/0105) BUILT + merged; `services/license` carries the X-2 cycle→grant mapper + entitlement
resolver + Worker filtering (PR#18, ADR-0089/0098/0071). **Remaining:** Ed25519 license **issuer**
(ADR-0010), revoke-on-cancel + one-time-purchase entitlement, buyer dashboard + seller cockpit,
publish-readiness. The **X-2 price-book gap** is **closed** (`@caisson/pricebook` + `invoice.paid`→grant,
ADR-0089/0098). Tags:
`external-system · security · billing`. Then P7+ round-out (vertical compliance packs, marketplace).

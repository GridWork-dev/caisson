# Decisions log

Short, dated, append-only. Why each non-obvious call was made.

## 2026-06-27

- **D1 — placeholders resolved without asking.** `[MEDIA_PIPELINE_REMOTE]` derived from gh
  (GridWork-dev/media-pipeline, the private parent of public tessera). `[WORKDIR]` defaulted
  to `~/lab/library-research`. `[NEW_LIBRARY_REPO_NAME]` deferred — it's a Phase 3 picker
  question. Operator runs "just do it"; gates (not setup) are the stop points.
- **D2 — media-pipeline clone into `WORKDIR/sources/`, not `~/lab` root.** Keeps the
  pro-private source isolated + clearly marked as ingested-source, out of the dev-profile
  collector's primary scan. Read-only.
- **D3 — Pro/private firewall.** Whole media-pipeline = `pro-private`. Its `tessera-public/`
  submodule is the open-core boundary (the standalone `~/lab/tessera` is the harvestable
  copy). Nothing pro-private seeds a sellable/public template — patterns/ideas only.
- **D4 — Phase 1 routing.** Per-repo extraction = Sonnet subagents (bounded, schema-locked,
  the recon lane), one per source, parallel. Cross-repo synthesis (the matrix + shortlist)
  = Opus main thread — that's where the harvestability judgment lives. Objective metrics
  (LOC/tests/ADRs) computed by script to ground-truth agent maturity estimates.

## 2026-06-27 (Phase 2, after operator reframe)

- **D5 — Vision reframe (operator).** Not narrow → **one composable base framework + broad
  verticalized editions**. **Rebuild clean** from proven strategies, do NOT port code.
  Business model is part of the research (bundles/individual/subscription/monthly-credits +
  value-adds). Research broad, not portfolio-limited. Model on prospector's method. Use
  DataForSEO + Exa.
- **D6 — Reused prospector adapters directly** (`tools/adapters/dataforseo.ts` etc.) via a
  WORKDIR driver, `PROSPECTOR_RUN` unset → echo-only, zero writes into the read-only repo.
  Modeled the scoring on prospector's SCORE_WEIGHTS + adversarial kill-gate ("LLM proposes,
  code owns arithmetic").
- **D7 — Workflow interrupted by session pause; resumed via `resumeFromRunId`** (cached
  agents replayed). Lesson: long Exa-heavy workflows survive pause via resume.
- **D8 — Ranking (rubric-as-code, `scores.json`):** Compliance edition 8.28 (hero), AI-infra
  7.06, local-first-AI 6.70 (open-core flank), agentic-dev-kernel 6.68, SaaS-base 5.76
  (substrate), generic boilerplate 4.60 (KILLED). Demand data: compliance CPC 10–50× others
  at low KD; generic boilerplate saturated/collapsing. Recurring revenue = compliance-update
  subscription + AI credits (both already metered in Wardfile/gridwork/tessera).

## 2026-06-27 (post-Gate-2 reframe — operator)

- **D9 — v1 scope = FULL DEPTH, base-first.** Build the base + a codebase architected for
  MANY areas, ground-up with standardized principles + coding strategies (not minimal
  base+1). A **separate dedicated session** will deep-dive the production standards + the
  module/item pipeline — Phase 5/6 must leave a clean seam for it.
- **D10 — Generic boilerplate UN-killed (amends D8).** Include generic-SaaS-boilerplate
  capability to compete with ShipFast/MakerKit too — but it's the **table-stakes base
  layer**; the **differentiators (compliance / local-first AI / AI-infra / production
  rigor) are the headline framing + main selling point.** Don't lead generic; lead
  differentiated, with generic as the "and it's also a better base than the others."
- **D11 — Post-purchase value-add stack is a first-class product surface**, not an
  afterthought: AI-support platform (Discord advanced-AI-support OR a dedicated full
  AI-support platform) with **human ticketing where the AI triages/briefs + is tagged into
  the ticket**, docs + setup/support guides, and a deep menu of post-purchase value-adds.
  Investigating the landscape (`support-strategy.md`) before the picker, per operator.
- **D12 — Umbrella positioning + AI Production Kit (operator).**
  - **Brand framing:** the whole library is **"your AI production codebase starter"** —
    production-grade, AI-native, the headline identity (production rigor as the hook).
  - **Ship a buyer-facing MCP server WITH AUTH** in the base + editions — the buyer's AI
    coding agent (Claude Code/Cursor) queries the shipped codebase's conventions/tools.
    (Market-validated value-add: MakerKit/LaunchKit already ship MCP servers; ours adds auth.)
  - **"AI Production Kit"** = a named **add-on**, sold **in bundles AND separately (à la
    carte)**: provider-agnostic **AI config for ALL providers** (OpenAI/Anthropic/Gemini/
    OpenRouter/local) + a **config file for the buyer's own settings** + **agent-assisted
    configuration** (the bundled agent walks setup — directly fills the research's
    "guided AI setup / coach-not-wizard" gap). This productizes edition #2 (AI-feature-add
    production-infra) as the "AI Production Kit." Seeds: gridwork model-router/BYOK +
    gridwork-core hooks/config + prospector cost-discipline.

## 2026-06-27 (Phase 3 picker outcomes)

- **D13 — Scope locked.**
  - **Repo:** monorepo (shared base + editions as packages; per-module à-la-carte commerce).
  - **Lead wedge:** broad compliance-records base + a **SOC2/HIPAA evidence-pack edition**
    first (highest demand + Clynova $999–1,999 anchor + most reusable; jurisdiction-agnostic).
  - **v1 depth:** FULL — **base + all four editions** (Compliance, AI Production Kit,
    Local-first AI, Claude-Code-native Agentic-Dev). Local-first = open-core flank.
  - **Support stack = CUSTOM, self-built** (NOT Inkeep/Plain): a Discord bot front-end +
    **Python LLM-dispatching** + a **RAG pipeline over the codebase** + **hosted inference
    (API calls — OpenRouter/Anthropic, not local models)** + deployed on **cloud runners for
    reliability** (operator's home machines reboot / lose power). Lives at
    `services/support-bot` in the monorepo and doubles as a shippable value-add template
    (on-brand for "your AI production codebase starter"). Docs tooling still open (Mintlify
    vs self-host) — defer to build.

## 2026-06-27 (Gate 4 — approved with amendment)

- **D14 — Features/architecture LOCKED; positioning DE-LOCKED.** The spec set + 12 ADRs
  (features, architecture, commerce mechanics) are approved/locked. **Positioning, hero,
  voice, name, and branding are NOT locked** — a **dedicated future positioning session**
  researches the best hero _across all differentiators_ (compliance / local-first / AI-infra /
  production rigor), **not the AI-only frame**, then refines voice. "AI production codebase
  starter" + "Forge" are provisional scaffolding only. Specs 00 + 03 amended to mark this.
- **D15 — Scaffold proceeds via a design-fork picker.** Before Phase 6 scaffolds, run a picker
  for the scaffold-time forks (working name, reference-app stack, the new repo's CLAUDE.md /
  governance style, first-skeleton depth).

## 2026-06-27 (scaffold session + docs review)

- **D16 — Gate 3 = Option C (recorded).** The Gate-3 pick was **Option C** (composable packages
  **+** the `create-stack` generator/registry + codegen-credits) — the generator is a **v1**
  priority, NOT v1.x. This explicitly supersedes `options.md`'s "Option B now, C in v1.x"
  recommendation (kept as provenance, now stale). plan.md P5 + specs are correct.
- **D17 — Scaffold session outcomes.**
  - Scaffold-fork picker: working name **`stack`** / `@stack/*`; **framework-agnostic core**
    (app framework deferred per edition); CLAUDE.md **mirrors Wardfile**; **base structure only,
    no skeleton**.
  - Repo scaffolded at `~/lab/stack` (90 files, full Option-C tree). Specs/ADRs/plan/SUMMARY
    copied in; research provenance consolidated to `outputs/research/`; **`library-research/`
    deleted** (cloned media-pipeline NOT carried over — firewalled, re-clonable).
  - **Docs-review fanout** (5 dimensions, 17 high / 22 med / 14 low → `outputs/research/review-findings.json`).
    Consistency fixes applied to kept specs (01-architecture invariants 3 + 6: Ed25519≠timingSafeEqual,
    MCP read-mostly + generator input-validation). Substantive gaps (missing ADRs, evidence-pack
    catalog, per-tenant key derivation, AGPL CI lint, idempotency schema) **routed to the kickoffs**.
  - **Stale provenance (kept, do not treat as current):** `options.md` B-recommendation (→ D16);
    `market-research.md` "defer Agentic-Dev" (→ D13 includes it in v1); `support-strategy.md`
    Inkeep/Plain picks (→ D13/ADR-0009 chose the custom support-bot).
  - **3 tracks chosen** → worktrees off `main` + kickoffs: **Foundations + Base (P0/P1)** ·
    **Positioning / hero / voice / branding** · **Module production-standards + pipeline (D9)**.
    (Compliance hero deferred to a later session — its review gaps noted in the foundations kickoff.)

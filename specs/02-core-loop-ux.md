# Core Loop & UX — Concept Spec

**Status:** spec-committed pending Gate 4. Implements the core loop in `00-product-spec.md §3`.
**Scope:** the buyer-facing surfaces + journey, and the seller ops surfaces. Visual system → `03-design-framework.md`.

## 1. Surfaces

| Surface                      | Who                   | Purpose                                                                                                                                |
| ---------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Marketing site**           | prospect              | positions "AI production codebase starter"; editions, modules, pricing, the differentiators (compliance/AI-prod/local-first); checkout |
| **Docs** (AI-native)         | buyer + buyer's agent | setup guides, edition/module reference, `llms.txt`/MCP; doubles as support-bot KB + buyer-agent context                                |
| **Buyer dashboard**          | buyer                 | entitlements, license, **credit balance + ledger**, registry access, generation history, subscription                                  |
| **`create-stack` CLI + MCP** | buyer / buyer's agent | the generation + agent-assisted configure surface                                                                                      |
| **Discord + support-bot**    | buyer                 | AI answers grounded in the codebase → escalates a brief to a tagged human ticket                                                       |
| **Seller cockpit**           | operator              | purchases, usage/credits, registry publishing, support queue, churn/MRR                                                                |

## 2. Buyer journey (the loop, screen by screen)

1. **Discover → Choose.** Marketing site → edition/module/bundle compare → MoR checkout (card). Per-module add-to-cart for à-la-carte. Subscription opt-in at checkout or later.
2. **Access granted (automated).** Webhook → private GitHub/registry access + **license issued** (Ed25519) + initial **credit grant**. Buyer lands on the dashboard with a "Generate your stack" CTA.
3. **Generate.** `npx create-stack` (or "ask your agent to set it up" via the MCP server): pick edition + modules + target (Next.js app / package-only) → tailored repo scaffolded from the registry. A **credit debit** + a `generation` record; the dashboard shows the run.
4. **Configure (agent-assisted — the coach).** The AI Production Kit writes a provider-agnostic AI config + a settings file; the agent walks env/providers/DB/deploy interactively (the coach-not-wizard). Setup guide in docs mirrors every step.
5. **Ship.** Buyer builds on a base that's already production-grade — fail-closed RLS, billing, credit metering, guardrails, (compliance) evidence engine — with CI gates that ship in the repo (test/lint/eval/RLS-force checks).
6. **Sustain.** `#ask-ai` in Discord answers from the codebase + escalates (brief → tagged human ticket); lifetime updates arrive via the registry; the subscription's monthly credits + **compliance-framework updates** + private-registry pulls renew value.

**Loop quality bars:** generation < a couple minutes; setup is agent-driven not a 2–4h wizard slog; first answer in Discord is code-grounded + cited; a buyer can buy/own a single module without the rest.

## 3. Seller ops loop (solo-operable)

purchase → automated access/license/credit grant → metered usage → registry-shipped updates → AI-deflected support (human only on judgment calls) → renewals via subscription/credits. **No recurring per-customer human step** (inherits Wardfile's solo-operability gate). The seller cockpit surfaces only exceptions: escalated tickets, failed grants, churn signals.

## 4. The generation UX (Option C, the differentiator)

- **CLI path:** `create-stack` — interactive prompts (edition, modules, stack target, providers) → writes the repo + a configured `forge.config.*` + `.env.example` + AGENTS.md.
- **Agent path:** the buyer says to Claude Code/Cursor "set up a HIPAA-compliant API with metered AI" → the agent queries the **MCP server** for available modules → composes the selection → drives `create-stack` → configures providers from the buyer's settings. Each generation metered.
- Both paths read the **same registry**; the docs document both; the support-bot can walk a buyer through either.

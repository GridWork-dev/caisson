---
updated: 2026-07-11
status: live
grounds:
  - knowledge/decisions/ADR-0254-measurement-pair-citation-loop-docs-funnel.md
  - outputs/research/kickoff-e-research-2026-07/w4-ai-citation.md
  - docs/gtm/gaps-and-plays.md
---

# AI-citation tracking loop (gap #9)

Pay-as-you-go probe loop through the already-sanctioned OpenRouter credential — no
subscription tracker (Peec/Otterly/Ahrefs Brand Radar all rejected at pre-launch volume,
per ADR-0254). Monthly cadence, ~$1.20/run in tokens. Script: `tooling/scripts/aeo-probe.ts`.
Workflow: `.github/workflows/aeo-probe.yml` (monthly cron + manual dispatch).

This doc is the single canonical query list — it doubles as `gw-aeo-strategist`'s
`category queries` briefing input (`claude/agents/gw-aeo-strategist.md` Inputs). Amend by
editing the list below; do not fork a second copy anywhere else.

## The 18-question probe set

Copied verbatim from `outputs/research/kickoff-e-research-2026-07/w4-ai-citation.md` §2.

**Compliance wedge (hero, ADR-0040) — 6:**

1. "What's the best SOC 2 starter kit for a Next.js SaaS?"
2. "Is there a HIPAA boilerplate for TypeScript/Bun teams?"
3. "What's a good self-hosted audit log solution for a regulated SaaS?"
4. "What's a multi-tenant RLS template I can build on for a compliance-heavy app?"
5. "How do I get fail-closed row-level security plus a SOC2 evidence pack without hiring a compliance team?"
6. "What's the best compliance-for-developers framework in 2026?"

**AI-Production bundle — 3:**

7. "What's a production-grade LLM cost-control / token-metering framework for a Bun/TypeScript app?"
8. "What tools give AI agent spend caps and circuit breakers out of the box?"
9. "Is there a versioned prompt registry + eval harness starter kit for shipping an AI feature to production?"

**Local-first AI (open flank) — 2:**

10. "What's a good offline-first AI app starter with sqlite-vec?"
11. "What's the best on-device/privacy-first AI stack for a regulated on-prem app?"

**Agentic-Dev — 2:**

12. "What's a governed-agent kernel for Claude-Code-driven development?"
13. "Is there a starter kit that ships an authenticated MCP server for buyer codebase access?"

**Category / generic (competitive discovery) — 3:**

14. "What's the best production-grade TypeScript monorepo starter in 2026?"
15. "Compare Caisson vs Vanta vs Drata for a startup that needs SOC2 fast."
16. "What's a good alternative to building compliance infrastructure from scratch?"

**Branded / direct — 2:**

17. "What is Caisson (caisson.sh)?"
18. "Is caisson.sh legitimate / worth buying for a regulated SaaS?"

## Engines probed

Routed through OpenRouter (the one sanctioned cross-vendor LLM credential,
`identity/doctrine.md` trust boundary) via direct REST `chat/completions` calls — PAL is a
session-time MCP tool and can't run from an unattended cron job, so this bypasses the MCP
wrapper for the same egress sink, same pattern as `gridwork-dream-llm` / `exa-monitors`
(brief §3).

| Engine slug (OpenRouter)    | Grounding                                                                                                                                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openai/gpt-5`              | `tools: [{ type: "openrouter:web_search" }]` server tool (the `:online` variant + `web` plugin are deprecated as of 2026 — verified live against `openrouter.ai/docs/guides/features/server-tools/web-search`) |
| `anthropic/claude-sonnet-5` | Same `openrouter:web_search` server tool                                                                                                                                                                       |
| `perplexity/sonar-pro`      | No tool needed — Sonar is inherently web-grounded                                                                                                                                                              |

Slugs verified live against `GET https://openrouter.ai/api/v1/models` at implementation time
(2026-07-06) — re-verify before each budget commitment; OpenRouter renames/retires aliases.

**Google AI Overviews** (the one surface no model API reaches — SERP-feature-only, not a
public API): evaluated per ADR-0254. DataForSEO's SERP API (`google/organic/live/advanced`
with `load_async_ai_overview: true`) is genuinely **pay-per-query cents, no subscription
floor** — "Pay-as-you-go pricing: you pay for the data you consume. No monthly subscriptions
and hidden costs" (dataforseo.com/apis/serp-api/pricing, verified 2026-07-06). Base Live
request ≈ $0.002–0.004 + the async-AI-Overview surcharge (refunded when no AI Overview is
present) ≈ **$0.002–0.005/query**, so the full 18-question AI-Overviews leg costs roughly
**$0.04–0.09/run** on top of the token spend. Wired as an **optional fourth leg**
(`probeAiOverview` in `tooling/scripts/aeo-probe.ts`), gated on `DATAFORSEO_LOGIN` +
`DATAFORSEO_PASSWORD` — skipped silently (not run, not failed) when either is unset, and any
per-query failure degrades to "not cited" rather than aborting the run. Results land in a
trailing "Google AI Overviews" subsection of each dated snapshot. Not yet armed (no
credentials provisioned this session, so this leg has not been exercised against a live
DataForSEO account) — the operator enables it by setting the two env vars.

## Snapshot format (append-only, dated sections)

Each run appends ONE dated `## YYYY-MM-DD run` section below the marker, never edits a
prior section (append-only, same convention as `docs/state/*.md`). Within a section, one
row per (question × engine): cited yes/no + a short evidence excerpt (the sentence that
mentioned Caisson, or "no mention" if not cited). A `mode` column states whether web-search
grounding was used for that call, and — when the DataForSEO leg is armed — a trailing
"AI Overviews" subsection lists caisson.sh mentions in the SERP AI Overview panel per query.

```md
## YYYY-MM-DD run

**Engines:** openai/gpt-5 (web_search) · anthropic/claude-sonnet-5 (web_search) · perplexity/sonar-pro (native)
**AI Overviews leg:** not run (DATAFORSEO_LOGIN/PASSWORD unset)

| #   | Question (truncated)     | Engine                    | Cited | Excerpt |
| --- | ------------------------ | ------------------------- | ----- | ------- |
| 1   | What's the best SOC 2... | openai/gpt-5              | no    | —       |
| 1   | What's the best SOC 2... | anthropic/claude-sonnet-5 | no    | —       |
| 1   | What's the best SOC 2... | perplexity/sonar-pro      | no    | —       |
| …   | …                        | …                         | …     | …       |
```

<!-- SNAPSHOTS BELOW THIS LINE — append-only, newest at the bottom -->

## 2026-07-06 run

**Engines:** openai/gpt-5 (web_search) · anthropic/claude-sonnet-5 (web_search) · perplexity/sonar-pro (native)
**AI Overviews leg:** not run (DATAFORSEO_LOGIN/PASSWORD unset)

| #   | Question (truncated)           | Engine                    | Cited | Excerpt                                                                                                                                                                 |
| --- | ------------------------------ | ------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | What's the best SOC 2 start... | openai/gpt-5              | no    | —                                                                                                                                                                       |
| 1   | What's the best SOC 2 start... | anthropic/claude-sonnet-5 | no    | —                                                                                                                                                                       |
| 1   | What's the best SOC 2 start... | perplexity/sonar-pro      | no    | —                                                                                                                                                                       |
| 2   | Is there a HIPAA boilerplat... | openai/gpt-5              | no    | —                                                                                                                                                                       |
| 2   | Is there a HIPAA boilerplat... | anthropic/claude-sonnet-5 | no    | —                                                                                                                                                                       |
| 2   | Is there a HIPAA boilerplat... | perplexity/sonar-pro      | no    | —                                                                                                                                                                       |
| 3   | What's a good self-hosted a... | openai/gpt-5              | no    | —                                                                                                                                                                       |
| 3   | What's a good self-hosted a... | anthropic/claude-sonnet-5 | no    | —                                                                                                                                                                       |
| 3   | What's a good self-hosted a... | perplexity/sonar-pro      | no    | —                                                                                                                                                                       |
| 4   | What's a multi-tenant RLS t... | openai/gpt-5              | no    | —                                                                                                                                                                       |
| 4   | What's a multi-tenant RLS t... | anthropic/claude-sonnet-5 | no    | —                                                                                                                                                                       |
| 4   | What's a multi-tenant RLS t... | perplexity/sonar-pro      | no    | —                                                                                                                                                                       |
| 5   | How do I get fail-closed ro... | openai/gpt-5              | no    | —                                                                                                                                                                       |
| 5   | How do I get fail-closed ro... | anthropic/claude-sonnet-5 | no    | —                                                                                                                                                                       |
| 5   | How do I get fail-closed ro... | perplexity/sonar-pro      | no    | —                                                                                                                                                                       |
| 6   | What's the best compliance-... | openai/gpt-5              | no    | —                                                                                                                                                                       |
| 6   | What's the best compliance-... | anthropic/claude-sonnet-5 | no    | —                                                                                                                                                                       |
| 6   | What's the best compliance-... | perplexity/sonar-pro      | no    | —                                                                                                                                                                       |
| 7   | What's a production-grade L... | openai/gpt-5              | no    | —                                                                                                                                                                       |
| 7   | What's a production-grade L... | anthropic/claude-sonnet-5 | no    | —                                                                                                                                                                       |
| 7   | What's a production-grade L... | perplexity/sonar-pro      | no    | —                                                                                                                                                                       |
| 8   | What tools give AI agent sp... | openai/gpt-5              | no    | —                                                                                                                                                                       |
| 8   | What tools give AI agent sp... | anthropic/claude-sonnet-5 | no    | —                                                                                                                                                                       |
| 8   | What tools give AI agent sp... | perplexity/sonar-pro      | no    | —                                                                                                                                                                       |
| 9   | Is there a versioned prompt... | openai/gpt-5              | no    | —                                                                                                                                                                       |
| 9   | Is there a versioned prompt... | anthropic/claude-sonnet-5 | no    | —                                                                                                                                                                       |
| 9   | Is there a versioned prompt... | perplexity/sonar-pro      | no    | —                                                                                                                                                                       |
| 10  | What's a good offline-first... | openai/gpt-5              | no    | —                                                                                                                                                                       |
| 10  | What's a good offline-first... | anthropic/claude-sonnet-5 | no    | —                                                                                                                                                                       |
| 10  | What's a good offline-first... | perplexity/sonar-pro      | no    | —                                                                                                                                                                       |
| 11  | What's the best on-device/p... | openai/gpt-5              | no    | —                                                                                                                                                                       |
| 11  | What's the best on-device/p... | anthropic/claude-sonnet-5 | no    | —                                                                                                                                                                       |
| 11  | What's the best on-device/p... | perplexity/sonar-pro      | no    | —                                                                                                                                                                       |
| 12  | What's a governed-agent ker... | openai/gpt-5              | no    | —                                                                                                                                                                       |
| 12  | What's a governed-agent ker... | anthropic/claude-sonnet-5 | no    | —                                                                                                                                                                       |
| 12  | What's a governed-agent ker... | perplexity/sonar-pro      | no    | —                                                                                                                                                                       |
| 13  | Is there a starter kit that... | openai/gpt-5              | no    | —                                                                                                                                                                       |
| 13  | Is there a starter kit that... | anthropic/claude-sonnet-5 | no    | —                                                                                                                                                                       |
| 13  | Is there a starter kit that... | perplexity/sonar-pro      | no    | —                                                                                                                                                                       |
| 14  | What's the best production-... | openai/gpt-5              | no    | —                                                                                                                                                                       |
| 14  | What's the best production-... | anthropic/claude-sonnet-5 | no    | —                                                                                                                                                                       |
| 14  | What's the best production-... | perplexity/sonar-pro      | no    | —                                                                                                                                                                       |
| 15  | Compare Caisson vs Vanta vs... | openai/gpt-5              | no    | —                                                                                                                                                                       |
| 15  | Compare Caisson vs Vanta vs... | anthropic/claude-sonnet-5 | yes   | # SOC 2 Compliance Tools: Caisson vs Vanta vs Drata Quick context check: Caisson isn't a widely established name in the SOC 2 automa                                    |
| 15  | Compare Caisson vs Vanta vs... | perplexity/sonar-pro      | yes   | tom environment and expect multi-framework complexity soon. Caisson is more niche and less established than either, so it’s rarely the fastest/lowest-risk path for a f |
| 16  | What's a good alternative t... | openai/gpt-5              | no    | —                                                                                                                                                                       |
| 16  | What's a good alternative t... | anthropic/claude-sonnet-5 | no    | —                                                                                                                                                                       |
| 16  | What's a good alternative t... | perplexity/sonar-pro      | no    | —                                                                                                                                                                       |
| 17  | What is Caisson (caisson.sh)?  | openai/gpt-5              | no    | —                                                                                                                                                                       |
| 17  | What is Caisson (caisson.sh)?  | anthropic/claude-sonnet-5 | yes   | # Caisson I don't have specific information about a tool called "Caisson" or a script called "caisson.sh" in                                                            |
| 17  | What is Caisson (caisson.sh)?  | perplexity/sonar-pro      | yes   | Caisson (caisson.sh) is a **software tool and language for designing hardware (digital circuits) with built                                                             |
| 18  | Is caisson.sh legitimate / ... | openai/gpt-5              | no    | —                                                                                                                                                                       |
| 18  | Is caisson.sh legitimate / ... | anthropic/claude-sonnet-5 | yes   | # Caisson.sh - Assessment I don't have reliable, verified information about "caisson.sh" as a specific product.                                                         |
| 18  | Is caisson.sh legitimate / ... | perplexity/sonar-pro      | yes   | Caisson.sh appears to be **too obscure / low‑signal at this point to recommend for a regulated SaaS**, and the                                                          |

## Cadence + cost

Monthly (`.github/workflows/aeo-probe.yml`, `schedule: cron`), matching `gw-aeo-strategist`'s
existing per-launch + quarterly dispatch cadence. ~54 calls/run (18 questions × 3 engines) ×
~$0.022/call ≈ **$1.20/run ≈ $1.20/mo**. Weekly is available (`bun tooling/scripts/aeo-probe.ts`
run ad hoc) at ~$5.20/mo if launch-week trend-watching is worth the extra spend — not wired
as a second cron, run manually via `workflow_dispatch` if needed.

## Results destination (both sinks, per ADR-0254 Decision 3)

1. **This doc** — the human/agent-readable trend + baseline, and the canonical query list.
2. **PostHog** — one `aeo_citation_probe` event per probe (`engine`, `query`, `cited`,
   `run_date`), config-gated on `POSTHOG_CAPTURE_KEY` (never throws — reuses the
   `services/license/src/posthog-capture.ts` never-throw pattern), queryable time-series for
   `gw-product-insights`' monthly pass too.

## Required GitHub Actions secrets (not set by this build — operator-visible per ADR-0254 Consequences)

- `OPENROUTER_API_KEY` — required for the loop to run at all; the workflow skips gracefully
  (green, no-op) when unset.
- `POSTHOG_CAPTURE_KEY` (+ optional `POSTHOG_CAPTURE_HOST`) — optional; PostHog capture is a
  no-op without it, the doc snapshot still lands.
- `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` — optional; the AI-Overviews leg is skipped
  without them.

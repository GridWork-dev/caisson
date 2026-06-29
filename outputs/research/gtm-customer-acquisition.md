# Caisson GTM & Customer Acquisition

> **Provenance.** Decision-grade go-to-market plan for a paid source-code developer product.
> Prepared by **Perplexity Computer**, June 28, 2026. Imported to the repo 2026-06-29 from
> `caisson-gtm-customer-acquisition-report.pdf` (source PDF kept alongside this file:
> `outputs/research/gtm-customer-acquisition-report.pdf`). This is an **external research input**,
> not a Caisson decision — locks remain operator-owned (`docs/state/decisions-and-forks.md`).
> Cross-analysis vs the current build/decisions → `outputs/research/gtm-market-analysis-2026-06.md`.

## Executive summary (the GTM in one page)

- **Motion** — Primary: **content-led inbound** around EU AI Act, SOC2-as-code, compliance
  engineering. Secondary: community-seeded GitHub/HN discovery.
- **Beachhead** — **Series A–B fintech/healthtech AI teams** with TypeScript/Next.js, enterprise
  compliance pressure, and Cursor/Claude Code usage.
- **Economics** — the **Compliance tier carries the model**: ~2.2–2.4 month payback and ~6× 2-year
  LTV:CAC at 60% update renewal.
- **Do not copy SaaS PLG** — no hosted free tier, no vendor telemetry, no seat expansion. Use a free
  **code sample**, docs, and **founder-assisted close** instead.

## GTM motion selection

| Motion            | Role            | Why                                                |
| ----------------- | --------------- | -------------------------------------------------- |
| Content / SEO     | **Primary**     | High intent, low CPL, trust building               |
| Community         | Secondary       | Proof + feedback; unreliable direct conversion     |
| Founder-led sales | Compliance only | Needed for high-ticket trust + objection discovery |
| PLG / free        | Evaluation aid  | Free code sample replaces a hosted trial           |
| Paid              | Narrow tests    | CPC/CPL too high before conversion proof           |

## Beachhead, triggers, and messaging

| Persona / segment          | Trigger                               | Channel                | Lead message                                     |
| -------------------------- | ------------------------------------- | ---------------------- | ------------------------------------------------ |
| Series A–B fintech AI team | SOC2 + enterprise buyer + EU exposure | SEO + founder outbound | Compliance controls live in the code path        |
| Healthtech platform lead   | HIPAA + AI feature launch             | SEO + vCISO refs       | Audit trails, encryption, evidence packs in repo |
| AI-native SaaS CTO         | LLM cost/governance issue             | HN/X + content         | Production-rigor AI kit without extra vendors    |
| Compliance consultant      | Repeat client implementation          | Partner referral       | Reusable code layer for client controls          |
| Platform/agentic lead      | Cursor/Claude rollout                 | GitHub + community     | Governed agent-readable repo standard            |

**Acquisition narrative:** Compliance is not just a dashboard. For regulated AI SaaS, the controls
that matter most are _application architecture_ — WORM audit logs, tamper-evident records, tenant
encryption, prompt/eval evidence, and signed evidence packs.

## Channel strategy and ranking

| Channel          | Modeled economics          | First play                                      |
| ---------------- | -------------------------- | ----------------------------------------------- |
| SEO / docs       | $150–$600 CAC              | EU AI Act engineering checklist + WORM tutorial |
| Founder outbound | $800–$1,200 CAC incl. time | 50 named fintech/healthtech CTOs                |
| Partners         | 20% referral commission    | 5 compliance consultants with demo kit          |
| Newsletter       | $90–$150 CPM               | TLDR / security newsletter vanity-URL test      |
| Paid search      | $6–$10 CPC                 | Exact-match retargeting only after proof        |
| LinkedIn         | $188–$791 CPL              | Sponsored messages only to named ICP            |

## Content & SEO engine (docs-as-marketing)

| Pillar                     | Examples                                          |
| -------------------------- | ------------------------------------------------- |
| EU AI Act engineering      | Articles 9–15 checklist; Annex IV starter         |
| SOC2 / HIPAA code controls | SOC2 Type II in a monorepo; HIPAA for engineers   |
| Compliance primitives      | WORM logs; hash-chain audit trails; encryption    |
| AI production              | LLM cost metering; eval CI gates; prompt registry |
| Comparison pages           | Vanta vs Caisson; Makerkit vs Caisson             |

## Launch strategy (pre-launch seeding > Product Hunt theater)

| Phase      | Assets                                                                           | Target                      |
| ---------- | -------------------------------------------------------------------------------- | --------------------------- |
| L-4 to L-1 | Waitlist, HN/PH drafts, GitHub README, payment/licensing, 10–15 seeded ICP leads | 200+ emails                 |
| Day 0–1    | Founder blog, Show HN, PH, X thread, waitlist email, comment response            | 50+ HN upvotes, 20 comments |
| Weeks 2–6  | Follow-up, WORM tutorial, funnel analysis, pricing/copy iteration                | First compliance close      |

## Funnel & conversion benchmarks

A purchased code product converts through **evaluation trust**, not hosted-trial telemetry.

| Stage                 | Modeled conversion | Measurement proxy                            |
| --------------------- | ------------------ | -------------------------------------------- |
| Visitors → engaged    | 25%                | Docs depth, email, GitHub star               |
| Engaged → evaluation  | 20%                | Generator run or sample clone                |
| Evaluation → intent   | 15%                | Pricing view, founder DM, community question |
| Intent → purchase     | 20–33%             | Checkout or invoice                          |
| Purchase → activation | 70%                | First module in staging within 30 days       |

## CAC, payback, and unit economics

| Tier       | Y1 rev/customer | CAC       | Payback     | 2Y LTV:CAC |
| ---------- | --------------- | --------- | ----------- | ---------- |
| Standard   | $1,139          | $760–$800 | ~8 mo       | ~1.7–1.8×  |
| Compliance | $4,523          | $844–$885 | ~2.2–2.4 mo | ~6.1–6.4×  |

**Compliance tier carries the business; standard tier is community + data.**

## Pricing page and offer (as recommended by the report)

| Tier                | One-time | Updates   | Conversion role                      |
| ------------------- | -------- | --------- | ------------------------------------ |
| Starter             | $499     | $299/yr   | Low-friction entry + activation data |
| Professional        | $999     | $499/yr   | Standard self-serve anchor           |
| Team                | $1,799   | $799/yr   | Small-team bundle                    |
| Compliance          | $2,999   | $1,499/yr | Hero tier, founder-assisted          |
| Compliance + AI Kit | $4,499   | $1,999/yr | Regulated-AI bundle                  |

- **Guarantee:** a **30-day money-back guarantee** should be prominent, not buried.
- **Trust proof:** show a sample evidence pack, an architecture page, commercial-license clarity.
- **TCO anchor:** compare 3-year Caisson cost to Vanta-style annual SaaS — but avoid replacement overclaim.

## Lifecycle, retention, and expansion

Update subscriptions are **regulatory insurance**, not generic maintenance.

| Stage       | Action                                    | KPI                 |
| ----------- | ----------------------------------------- | ------------------- |
| Day 0       | License delivery + 30-minute success path | CLI run within 48h  |
| Day 7       | Generate first evidence pack              | First audit event   |
| Day 30      | Activation check + NPS-style email        | 70% activation      |
| Month 6     | Case study / referral ask                 | 15% public advocacy |
| Month 10–11 | Changelog value summary + renewal preview | 60% renewal         |

**Renewal framing:** your perpetual license gives you the version you purchased forever; the update
subscription delivers architectural patterns that track EU AI Act / SOC2 / HIPAA changes so your
compliance layer does not go stale.

## Competitive GTM teardown (borrow patterns, avoid category traps)

| Group           | Lesson                                     | Trap                           |
| --------------- | ------------------------------------------ | ------------------------------ |
| Boilerplates    | Quantify time saved; self-serve purchase   | Personal brand is not portable |
| Compliance SaaS | Partner refs + ROI calculators compound    | Demo-gating too early          |
| AI infra        | GitHub-first trust; security posture sells | OSS without a revenue fence    |
| Local-first     | Viral technical demo + integrations        | Vocabulary too technical       |
| Agentic dev     | CLI-first; developer smuggling             | No daily productivity loop     |

## Measurement operating system

| Cadence   | Decision                              | Alarm                           |
| --------- | ------------------------------------- | ------------------------------- |
| Weekly    | Which 1–2 experiments run next?       | <20 GitHub stars/week by M3     |
| Monthly   | Shift channel budget + content themes | <5 licenses/mo by M3            |
| Quarterly | Reprice, reposition, or scale         | CAC > $1,500 or activation <60% |

## Budget & resourcing

One founder + a part-time technical writer can run the first 90 days. Outsource diagrams and
compliance/legal review. **Delay** SDR, VP Marketing, and full-time paid acquisition until
conversion + WTP are proven.

## Scenarios, roadmap, and experiments

| Scenario                          | Probability | Action                                                  |
| --------------------------------- | ----------- | ------------------------------------------------------- |
| Base: compliance timing wins      | 60%         | Execute content + first 10 logos                        |
| Upside: regulation forces buying  | 20%         | Hire solutions help; prepare enterprise waitlist        |
| Downside: AI codegen narrows moat | 20%         | Move up-market to attorney-reviewed patterns + services |

**Priority experiments:** 30-day-guarantee prominence (→ pricing conversion) · free EU AI Act starter
module (→ evaluation rate) · founder outreach to 50 CTOs (→ compliance pipeline) · update-sub at
checkout vs Day 30 (→ attach rate).

## SWOT & risk heatmap

- **Strengths** — high-WTP compliance wedge; own-code differentiation; urgent regulatory narrative.
- **Weaknesses** — no incumbent trust; no hosted telemetry; one-time revenue lumpiness.
- **Opportunities** — EU AI Act timing; vCISO referrals; AI governance; agentic-dev codebase standards.
- **Threats** — AI codegen commoditizes; incumbents expand; platforms bundle; CAC exceeds price.

## Methodology & key caveat

Modeled inputs labeled fact / estimate / assumption: Compliance WTP $2,999–$4,999 + updates
(assumption — validate via 20 ICP interviews + first 10 sales); update renewal 55–65% (assumption);
organic purchase CVR 1.5–3.0% (estimate); paid-search CPC $6–$10 (estimate); demo-to-close 20–30%
(fact + estimate). **Key caveat:** there is no public benchmark dataset for paid source-code
libraries — the report triangulates from devtools, compliance SaaS, security SaaS, LegalTech/RegTech,
paid boilerplates, and OSS-to-enterprise infra. Treat modeled economics as **directional** until
Caisson has first-party funnel data.

## Selected sources

First Page Sage funnel benchmarks 2025 · SEO Sherpa B2B SEO statistics 2025 · Dreamdata Google Search
non-branded ads benchmark 2025 · ChartMogul SaaS conversion report 2025 · daily.dev HN + developer-
podcast benchmarks 2025 · AdCommons newsletter ad costs 2025 · LinkedIn 2025 ad benchmarks (Scott
Schnaars) · WordStream Google Ads benchmarks 2025 · Optif.ai + Zeliq CPL benchmarks 2025 · Martal +
Belkins cold-email stats 2025 · PuppyDog demo-to-close benchmarks 2025 · Product Hunt launch statistics
2025 · Working Reference ShipFast GTM case · Makerkit cost analysis · StarterPick SaaS boilerplate
market map 2026. (Full URLs in the source PDF.)

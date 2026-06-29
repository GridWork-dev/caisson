# Caisson Market Research & Competitive Analysis

> **Provenance.** Decision-grade strategy report for a productized monorepo library serving
> regulated, AI-heavy SaaS teams. Prepared by **Perplexity Computer**, June 27, 2026. Imported to
> the repo 2026-06-29 from `caisson-market-research-competitive-analysis.pdf` (source PDF kept
> alongside: `outputs/research/market-competitive-analysis-report.pdf`). An **external research
> input**, not a Caisson decision. Cross-analysis vs the current build/decisions →
> `outputs/research/gtm-market-analysis-2026-06.md`.

## Primary verdict

- **Lead with Compliance** under a production-rigor umbrella; **do not** compete head-on as a $299
  boilerplate.
- **Strategic wedge** — application-level compliance controls, AI auditability, evidence packs, and
  **code ownership**.
- **Pricing anchor** — **$2,999–$4,999 Compliance perpetual + $1,499–$1,999/year updates**.

## Executive summary

| Decision       | Answer                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Category       | Code-owned production-rigor infrastructure, **not** a premium SaaS starter. The wedge is **compliance-as-code-you-own**. |
| Market         | Compliance + AI production are large enough for venture-scale adjacency. Local-first is useful but too early to lead.    |
| GTM            | Land **regulated AI teams first**: fintech, healthtech, legal AI, insurtech, infra AI with audit pressure.               |
| Hero edition   | Compliance                                                                                                               |
| Umbrella       | Production-rigor codebase / code-owned production infrastructure                                                         |
| Thesis verdict | **Validated** for regulated AI-heavy ICP; **weak** for general indie SaaS                                                |
| Primary threat | The **compliance-is-service objection**, not AI codegen                                                                  |
| 6-month focus  | EU AI Act evidence path, signed packs, AI gateway, auditor trust                                                         |

## Market sizing — TAM / SAM / SOM by category

All Caisson SAM/SOM rows are estimates; top-down anchors are sourced.

| Category         | TAM anchor                    | Caisson SAM | 3-yr SOM    | Confidence |
| ---------------- | ----------------------------- | ----------- | ----------- | ---------- |
| Boilerplates     | $84M–$252M                    | $25M–$50M   | $1M–$5M     | Medium     |
| Compliance / GRC | $2.8B dev-facing / $56.7B GRC | $280M–$500M | $2M–$10M    | **High**   |
| EU AI Act        | $609M                         | $50M–$100M  | $0.5M–$3M   | Medium     |
| AI production    | $3.2B–$6B                     | $500M–$900M | $3M–$18M    | Medium     |
| AI gateway       | $0.8B–$1.2B                   | $100M–$200M | $1M–$5M     | Medium     |
| Local-first      | No TAM found                  | $5M–$20M    | $0.2M–$1.5M | Low        |
| Agentic dev      | ~$1.05B infra slice           | $100M–$200M | $2M–$10M    | Medium     |

**Bundled opportunity:** overlap-adjusted SAM ≈ **$1.0B–$1.7B**; realistic 3-year obtainable wedge
**$10M–$30M** if Caisson lands regulated AI teams at **$1.5K–$5K blended ACV**. (TAM figures overlap
heavily — direction, not investor-grade precision.)

## Competitor matrix — Base / boilerplate

| Product       | Model    | Price     | Strength                | Caisson gap/win                      |
| ------------- | -------- | --------- | ----------------------- | ------------------------------------ |
| ShipFast      | One-time | $199–$299 | Community + speed       | Caisson wins on multi-category rigor |
| Makerkit      | One-time | $149–$599 | Code quality + monorepo | Caisson needs deeper compliance/AI   |
| Supastarter   | One-time | $349+     | B2B starter             | Caisson wins on regulated AI         |
| SaaSBold      | One-time | $149–$379 | Design polish           | Caisson wins on architecture         |
| create-t3-app | OSS      | Free      | T3 defaults             | Caisson wins on production modules   |

**Implication:** use Base as the **trust + acquisition layer**. Do not lead with Base commercially
unless it is **open-core or priced as an entry ramp** into premium editions.

## Competitor matrix — Compliance (highest-WTP, strongest trust moat)

| Product     | Model           | Price signal             | Strength                  | Caisson win / loss                                   |
| ----------- | --------------- | ------------------------ | ------------------------- | ---------------------------------------------------- |
| Vanta       | SaaS            | $10K+ entry; $35K–$100K+ | Brand + integrations      | Win: app controls; lose: evidence network            |
| Drata       | SaaS            | $7.5K–$100K+             | Automation depth          | Win: version-controlled controls; lose: integrations |
| Secureframe | SaaS            | Quote-only               | Defense/CMMC              | Win: transparent code; lose: enterprise trust        |
| Sprinto     | SaaS            | $6K–$25K+                | Reviews + unlimited users | Win: no platform creep; lose: workflow               |
| Oneleet     | SaaS + services | $12K–$50K+               | Pen-test/vCISO bundle     | Win: engineering layer; lose: services               |
| Hyperproof  | Enterprise GRC  | Median ~$43.9K           | GRC maturity              | Win: lighter dev stack; lose: enterprise suite       |

- **Win condition:** buyer believes compliance engineering belongs **inside the app repository** —
  AI auditability, WORM logs, hash-chains, signed evidence packs.
- **Loss condition:** buyer needs an auditor marketplace, policy workflow, vendor risk, trust center,
  or managed compliance services immediately.

## Competitor matrix — AI Production Kit

| Product           | Model            | Pricing                    | Strength                | Caisson implication                   |
| ----------------- | ---------------- | -------------------------- | ----------------------- | ------------------------------------- |
| Vercel AI Gateway | Hosted           | $5 credit; zero markup     | Vercel-native           | Compete on **portability**            |
| OpenRouter        | Hosted           | Provider + platform fee    | Model breadth           | Compete on **in-repo spend controls** |
| LiteLLM           | OSS + enterprise | OSS free                   | Self-host proxy         | **Embed config; avoid re-building**   |
| Portkey           | SaaS             | Usage/log based            | Guardrails + enterprise | Avoid log-billing surprise            |
| Helicone          | OSS + SaaS       | Free/Pro/Team              | Simple proxy            | Acquisition uncertainty = opening     |
| Langfuse          | MIT OSS + cloud  | Free self-host; paid cloud | Evals + tracing         | **Integrate** rather than displace    |

## Competitor matrix — Local-first & Agentic-Dev

| Product          | Category    | Model / price                       | What matters                            |
| ---------------- | ----------- | ----------------------------------- | --------------------------------------- |
| ElectricSQL      | Local-first | OSS + Pro $249/mo + Scale $1,999/mo | Best Postgres-sync adapter candidate    |
| PowerSync        | Local-first | Free tier; paid thin                | Strong SQLite/offline positioning       |
| Zero             | Local-first | Apache-2 OSS; hosted TBD            | OSS undercut + perf credibility         |
| Jazz             | Local-first | $0–$19/mo+                          | Accessible hosted collaboration pricing |
| Convex           | Reactive DB | $25/dev/mo; $2,500 min              | Mature but not local-first              |
| Agentic-dev kits | Agentic-dev | Caliber, NanoClaw, Electric Agents  | Governance/config space still forming   |

- **Local-first:** do not lead with it. Package it as a **sovereignty/offline module** for health,
  field, edge, privacy-sensitive workflows.
- **Agentic:** make **engine-neutral config emission + MCP governance** core to Caisson's
  differentiation — a feature of **every edition**, not only a module.

## Business model & TCO

| Model                  | Use                           |
| ---------------------- | ----------------------------- |
| Perpetual + updates    | **Primary model**             |
| Per-module             | Premium editions              |
| Support SLA            | Enterprise tier               |
| Credits                | Optional AI-spend tooling     |
| Pure SaaS subscription | **Avoid** as core positioning |

**TCO message:** a $4,999 Compliance license + $1,999/year updates is rational when the alternative is
**$10K–$80K/year** in recurring compliance SaaS plus separate audit + implementation costs.

## Pricing & monetization (as recommended by the report)

| Offer             | Perpetual       | Updates          | Rationale                            |
| ----------------- | --------------- | ---------------- | ------------------------------------ |
| Base / Standard   | $999            | $499/yr          | Above boilerplates; still accessible |
| Compliance        | $2,999–$4,999   | $1,499–$1,999/yr | Anchored to Vanta/Drata alternative  |
| AI Production Kit | $1,499–$2,499   | $799–$1,199/yr   | Gateway/eval/spend controls          |
| Local-first AI    | $1,499–$2,999   | $799–$1,499/yr   | Specialized sovereignty/offline need |
| Agentic-Dev       | $999–$1,999     | $499–$999/yr     | Config/governance kit                |
| Full Bundle       | $6,999–$9,999   | $2,999–$3,999/yr | Enterprise-grade codebase bundle     |
| Enterprise        | $9,999–$24,999+ | SLA/support      | Regulated deployment assistance      |

**Retention lever:** the compliance-update subscription ships new regulatory templates, control
mappings, evidence-pack schemas, migration guides. **Buyer promise:** customers own the version they
bought; updates are paid because regulations evolve.

## Buyer personas / ICP

| Persona                  | Need                                                 | Lead edition       |
| ------------------------ | ---------------------------------------------------- | ------------------ |
| AI Compliance Lead       | Auditable AI controls before SOC2/EU AI Act scrutiny | Compliance         |
| AI-native Startup CTO    | LLM spend caps, eval gates, production defaults      | AI Production      |
| Regulated Platform Lead  | Tenant isolation, PHI/PII safeguards, audit trails   | Compliance + Base  |
| Local-first Product Lead | Offline, data-sovereign, on-device AI                | Local-first        |
| Agentic Platform Owner   | Governed Cursor/Claude/Codex configs                 | Agentic-Dev        |
| Compliance Agency        | Reusable scaffold across regulated clients           | Enterprise/support |

## Demand signals & regulatory hooks

- **Keyword gap:** open research gave **no reliable keyword volume** — commission Ahrefs/SEMrush
  before paid SEO spend.
- **Timed hooks:** **August 2, 2026** transparency/enforcement and **December 2027** high-risk
  readiness as content + launch milestones.

## Distribution & GTM phases

| Phase    | Motion                   | Channels                                                | Metric                  |
| -------- | ------------------------ | ------------------------------------------------------- | ----------------------- |
| 0–6 mo   | Community discovery      | GitHub, HN, daily.dev, X, technical docs                | 500 stars; 10 ICP calls |
| 6–12 mo  | Regulated ICP activation | EU AI Act SEO, compliance partners, founder communities | 10 licenses/mo; 3 logos |
| 12–24 mo | Enterprise ecosystem     | Supabase/Vercel/Railway, agencies, MCP marketplaces     | $300K ARR; partners     |

**Content wedge:** "Compliance is engineering, not a spreadsheet." **Protect the channel:** don't
over-sell in community — let the repo, docs, demo, and design-partner proof sell first.

## Threats & risks

| Risk                            | Severity | Mitigation                                                                      |
| ------------------------------- | -------- | ------------------------------------------------------------------------------- |
| AI codegen commoditizes Base    | High     | Make Caisson the expert reference implementation agents extend                  |
| Compliance-is-service objection | High     | Separate GRC admin from app-level compliance engineering; partner with auditors |
| OSS undercut                    | Medium   | Open-source base; commercialize compliance + AI governance                      |
| Incumbent expansion             | Medium   | Complement cloud/GRC tooling; own in-repo application controls                  |
| Buyer trust                     | High     | Publish evidence schemas, legal-review letters, pilot case studies              |

## Trends 2026–2027

EU AI Act enforcement (primary deadline-driven wedge) · LLM FinOps (integer credits + spend caps +
routing ledger become core infra) · MCP ecosystem (distribution + agent-operability) · local-first /
self-hosted (sovereignty + offline) · regulation-as-code (future live-rule-sync adapter layer) ·
AI-agent-optimized codebases (a schema-rich TS monorepo becomes the product).

## Scenarios & prioritized recommendations

| Scenario                        | Prob. | Outcome                                                                 |
| ------------------------------- | ----- | ----------------------------------------------------------------------- |
| Compliance timing wins          | 65%   | 20–50 compliance-tier licenses in first 12 mo; update revenue compounds |
| AI codegen wins                 | 20%   | Base compresses; legal/auditor moat + services matter more              |
| Regulation-as-code standardizes | 15%   | Caisson becomes adapter layer between official rules + app code         |

**Six prioritized recommendations:** (1) Lead with Compliance, not Base. (2) Price at compliance value
**$2,999–$4,999 + updates**. (3) Ship the EU AI Act evidence path: WORM logs, hash chain, keys, signed
packs. (4) Open-source non-differentiating Base; commercialize premium modules. (5) Make MCP + agent
rules first-class in `create-caisson`. (6) Build auditor trust before scaling sales.

## Methodology & critical validation tasks

Labels: fact (sourced) · estimate (derived TAM/WTP/TCO) · assumption (needs interview/pilot
validation) · thin data (local-first TAM, some agentic-dev pricing). **Critical validation tasks:**
run 20 ICP interviews; obtain Ahrefs/SEMrush keyword volumes; validate compliance-tier WTP with paid
pilots; secure auditor/legal review; pull GitHub-API trend data for local-first + AI-production repos.

## Selected sources

StarterPick 2026 SaaS boilerplate market map · Mordor Intelligence GRC market · SOC2Certification.com
SOC 2 automation market · Vanta ARR announcement · Dimension Market Research EU AI Act compliance
market · DataIntelo LLMOps market · Marketintelo AI gateway market · MarketsandMarkets Agentic AI
market · EU AI Act implementation timeline · EC AI-generated-content Code of Practice · Vendr Vanta
marketplace · ComplyJet Drata pricing guide · Vercel AI Gateway / OpenRouter / Langfuse pricing ·
ElectricSQL / Jazz pricing · KnowMine MCP ecosystem analysis · CSA AI-generated-code risk note ·
JetBrains perpetual-fallback license. (Full URLs in the source PDF.)

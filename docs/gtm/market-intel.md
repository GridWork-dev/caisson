---
updated: 2026-07-05
status: live
grounds:
  - outputs/research/market-research.md
  - outputs/research/market-competitive-analysis.md
  - outputs/research/gtm-market-analysis-2026-06.md
  - outputs/research/demand-signals.md
  - outputs/research/options.md
---

# Market intel

External research only — not a decision surface. Every number below is a scrape or a
research-firm estimate, dated at the point of citation. Caisson's own committed pricing lives in
`pricing-packaging.md`; this file is the outside view that pricing reasons from.

## 1. Category landscape — who Caisson actually competes with, per segment

Caisson doesn't have one competitor set — each edition sits in a different market with a
different incumbent shape. Source: two Perplexity Computer research passes, 2026-06-27
(`market-research.md`) and 2026-06-27 imported 2026-06-29 (`market-competitive-analysis.md`).

| Segment                | Who Caisson competes with                                                                                                                                                                          | Shape                                                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Base / boilerplate** | ShipFast ($199–299), Makerkit ($149–599), Supastarter ($349+), SaaSBold ($149–379), create-t3-app (free OSS)                                                                                       | One-time, brand-driven, commoditizing under AI codegen. Caisson does not compete here as a hero — Base is substrate, not a SKU (options.md, 2026-06-27) |
| **Compliance / GRC**   | Vanta ($10K+ entry, $35K–100K+/yr), Drata ($7.5K–100K+/yr), Secureframe (quote-only), Sprinto ($6K–25K+/yr), Oneleet ($12K–50K+/yr), Hyperproof (~$43.9K median)                                   | Funded SaaS platforms selling audit/GRC administration, not app-level code. This is the hero wedge — see §2                                             |
| **AI Production Kit**  | Vercel AI Gateway ($5 credit, zero markup), OpenRouter (provider + platform fee), LiteLLM (OSS + enterprise), Portkey (usage/log-based), Helicone (free/Pro/Team), Langfuse (MIT OSS + paid cloud) | Gateway/observability tooling Caisson should integrate with, not rebuild (market-competitive-analysis.md I4)                                            |
| **Local-first AI**     | ElectricSQL (OSS + Pro $249/mo + Scale $1,999/mo), PowerSync (free tier, thin paid), Zero (Apache-2 OSS), Jazz ($0–19/mo+), Convex ($25/dev/mo, $2,500 min)                                        | Mostly OSS-led sync/offline frameworks; monetize via license/Pro tier, not the runtime itself                                                           |
| **Agentic-Dev**        | Caliber, NanoClaw, Electric Agents (named, pricing thin)                                                                                                                                           | Governance/config space still forming — no dominant incumbent as of 2026-06-27                                                                          |

**Read:** Caisson is not "another boilerplate." Its real competitive set is the compliance-SaaS
tier on one side (over-priced for a dev buyer, sells GRC admin not code) and free/cheap OSS
frameworks on the other (Base, AI gateway, local-first). The wedge is the gap between them —
picks-and-shovels for teams building compliance/production-AI apps, not a competing platform.

## 2. The compliance wedge — Vanta-class vs library-class

This is the single highest-signal finding across both research passes and is treated as the hero
argument (ADR-0040 hero lock predates the research; the research validates it, per
`gtm-market-analysis-2026-06.md` §1).

- **Vanta-class (platform/SaaS-GRC):** Vanta, Drata, Secureframe, Sprinto, Oneleet, Hyperproof.
  Sell **auditor-facing GRC administration** — integrations, policy workflow, vendor risk, trust
  center, evidence collection _as a service_. Price is enterprise SaaS ($6K–100K+/yr).
  Buyer objection Caisson must pre-empt: _"isn't this just what Vanta does?"_ — no, Vanta manages
  the audit relationship; Caisson ships the **app-level controls** (RLS, WORM logs, hash-chained
  audit trail, signed evidence packs) _inside the repo the buyer owns_ (market-competitive-analysis.md
  I1/threats table, 2026-06-27).
- **Library-class (dev-kit / framework):** the nearest direct comparable named in research is
  **Clynova**, a HIPAA boilerplate at **$999–1,999 one-time** (market-research.md, 2026-06-27) —
  cited as proof a compliance dev-kit sells at 5–10x the price of a generic boilerplate. No
  competitor was found shipping the full **RLS + S3 Object-Lock WORM + append-only hash-chain
  audit trail + multi-jurisdiction module registry** stack at the app tier — both research passes
  independently call this "no turnkey starter exists" (market-research.md §1; market-competitive-analysis.md
  win condition).
- **Win condition:** buyer believes compliance engineering belongs in the app repository they
  own, not in a third-party GRC console.
- **Loss condition:** buyer actually needs an auditor marketplace, policy workflow, or managed
  compliance services on day one — that buyer wants Vanta, not Caisson.

**SERP evidence (DataForSEO, 2026-06-27):** the compliance search results are owned entirely by
finished platforms (Vanta, Usercentrics, Cynomi, MetricStream, Comply for "compliance software";
Vanta, Drata, AppOmni, Sprinto for "compliance saas") — zero dev-tooling/framework brands appear
on page one. That's the picks-and-shovels gap, not a saturated field (`demand-signals.md`).

## 3. Component/library-market pricing norms

Two separate reads, both dated 2026-06-27, converge on the same shape:

- **Generic boilerplates cluster $149–599 one-time** with lifetime updates (ShipFast, Makerkit,
  Supastarter, SaaSBold) — and are actively compressing: **Tailwind Plus revenue fell ~80%**
  as AI codegen erodes the value of hand-authored scaffolding (market-research.md §1). Free OSS
  (create-t3-app, Open SaaS) eats the floor further. Competing here on price/brand alone is a
  losing game against incumbents with years of community lead.
- **Compliance-specific dev-kits price 5–10x higher** than generic boilerplate — Clynova at
  $999–1,999 one-time is the closest direct anchor (market-research.md §2, opportunity ①).
- **Framework/control-update subscriptions are the market's only proven recurring-revenue shape**
  for this product class: compliance.tf ~$1K/yr, Archiet $1.2K–16.8K/yr, SchemaPilot $588–5,988/yr
  (market-research.md §1). The mechanism: compliance frameworks churn constantly (NIS2, EU AI Act
  Annex IV, DORA, new US state privacy law), so an auto-updating control-mapping + evidence-pack
  feed is the strongest retention lever available to this category — independent of what Caisson
  ultimately charges.
- **Full compliance-platform TCO context** (for anchoring, not matching): a $2,999–4,999
  perpetual license + $1,499–1,999/yr updates is "rational" against a $10K–80K/yr Vanta/Drata
  alternative (market-competitive-analysis.md, TCO table) — this is a research-firm estimate
  (labeled "assumption" pending ICP interviews in the source), not a Caisson commitment.
- **AI-usage credit economies are the second proven recurring shape**: StackAlchemist
  $299–999/generation, and the v0/Copilot/Lovable credit model generally; Copilot's June-2026
  25x billing-shock event is cited as evidence of demand for usage-capped, predictable billing
  (market-research.md §1, dated within the same 2026-06-27 pass).

**Open fork, not decided:** Caisson's own pricing structure — specifically whether the
Compliance edition stays one SKU or splits into separately sellable framework-catalog /
evidence-assembly / signing surfaces (the "R3 compliance split" fork) — was redirected 2026-07-05
into a broader catalog-doctrine question: whether **all editions become bundle options over an
individually-sellable package catalog**, with explicit OSS/commercial-line and package-split
standards. That research is in flight (`outputs/research/catalog-doctrine-2026-07.md`, not yet
landed as of this writing) and nothing above should be read as resolving it. Actual committed
numbers and the locked purchase-policy ADRs (ADR-0244 perpetual-use + 12-month included updates +
~40% paid renewal; ADR-0245 pooled-rollover credits, 12-month expiry, FIFO burn) live in
`pricing-packaging.md`.

## 4. Demand signals (dated)

**DataForSEO probe, US Google Ads volume/CPC/KD, run 2026-06-27** (`demand-signals.md`,
probe cost $0.26; CPC used as a willingness-to-pay proxy, KD = keyword difficulty 0–100, lower
= more winnable):

| Keyword                           | Vol/mo |   CPC |  KD | Cluster                |
| --------------------------------- | -----: | ----: | --: | ---------------------- |
| legal billing software            |  1,300 |  $261 |  41 | compliance/legal       |
| compliance automation software    |    480 |  $212 |  10 | compliance             |
| soc 2 compliance software         |    320 |  $171 |  28 | compliance             |
| legal document automation         |    140 |  $152 |   5 | compliance/legal       |
| blackline reconciliation software |    210 |  $148 |   0 | compliance/fin-ops     |
| automated billing software        |    390 |  $121 |   7 | compliance/fin-ops     |
| compliance management system      |    880 |  $112 |  18 | compliance             |
| policy management software        |    880 |  $106 |  12 | compliance             |
| hipaa compliant software          |  4,400 |   $70 |  16 | compliance/health      |
| edge ai                           |  5,400 |   $24 |  29 | local-first AI         |
| ai coding agent                   |  4,400 |   $24 |  23 | AI/agent               |
| ai agent framework                |  1,300 |   $15 |  32 | AI/agent               |
| shipfast (branded)                |    720 |   $26 |  10 | boilerplate            |
| private ai                        |  1,900 | $4.33 |  23 | local-first AI         |
| saas boilerplate                  |    140 |   $20 |  17 | boilerplate (category) |

**Read (2026-06-27):** compliance keywords carry 10–50x the CPC of every other cluster at low
keyword-difficulty — a high-budget, SEO-underserved buyer segment. Local-first AI has real
volume and low KD but far lower CPC (cheaper buyer, OSS-crowded SERP). Generic boilerplate terms
are low-volume and brand-driven (people search "shipfast," not "saas boilerplate") — confirms it
as commodity, not a demand category.

**Known gap, both research passes, 2026-06-27:** no reliable keyword-volume data exists for
Caisson's actual product terms — commission Ahrefs/SEMrush before committing paid SEO spend.
This is a stated validation task, not yet done as of this writing.

**Market sizing (Perplexity Computer estimate, 2026-06-27, `market-competitive-analysis.md`)** —
labeled by the source as top-down/estimate, not a Caisson forecast:

| Category         | TAM anchor                    | Caisson SAM (est.) | 3-yr SOM (est.) | Confidence             |
| ---------------- | ----------------------------- | ------------------ | --------------- | ---------------------- |
| Compliance / GRC | $2.8B dev-facing / $56.7B GRC | $280M–500M         | $2M–10M         | High (of the estimate) |
| AI production    | $3.2B–6B                      | $500M–900M         | $3M–18M         | Medium                 |
| EU AI Act        | $609M                         | $50M–100M          | $0.5M–3M        | Medium                 |
| AI gateway       | $0.8B–1.2B                    | $100M–200M         | $1M–5M          | Medium                 |
| Boilerplates     | $84M–252M                     | $25M–50M           | $1M–5M          | Medium                 |
| Local-first      | no TAM found                  | $5M–20M            | $0.2M–1.5M      | Low                    |
| Agentic dev      | ~$1.05B infra slice           | $100M–200M         | $2M–10M         | Medium                 |

Bundled/overlap-adjusted SAM ≈ $1.0B–1.7B; realistic 3-year obtainable wedge $10M–30M **if**
Caisson lands regulated-AI teams at a $1.5K–5K blended ACV (source's own framing, 2026-06-27) —
none of this is validated by a sale yet.

**Regulatory timing hooks** (both passes, 2026-06-27): **August 2, 2026** — EU AI Act
transparency/enforcement date; **December 2027** — high-risk system readiness deadline. Both are
named as content/launch-calendar anchors, not internal deadlines.

## 5. Threats named in research (2026-06-27, for awareness — not yet mitigated in-repo)

| Risk                              | Severity | Named mitigation                                                                                                                                                                            |
| --------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI codegen commoditizes Base      | High     | Make Caisson the reference implementation agents extend, not compete with                                                                                                                   |
| "Compliance-is-service" objection | High     | Separate GRC administration (their job) from app-level compliance engineering (Caisson's) in copy                                                                                           |
| OSS undercut                      | Medium   | Source recommends open-sourcing Base — **conflicts with the locked fully-commercial position** (ADR-0023/0050/0083); unresolved, tracked as a standing external recommendation, not adopted |
| Incumbent expansion               | Medium   | Complement cloud/GRC tooling rather than compete on their turf                                                                                                                              |
| Buyer trust                       | High     | Publish evidence schemas, legal-review letters, pilot case studies (none published as of this writing)                                                                                      |

## Sources

Perplexity Computer, "Caisson Market Research & Competitive Analysis," 2026-06-27 (imported
2026-06-29, PDF: `outputs/research/market-competitive-analysis-report.pdf`); prospector-modeled
multi-source assay, 2026-06-27 (`outputs/research/market-research.md`, DataForSEO + Exa +
5 spine deep-dives, probe cost $0.26 + ~1.3M agent tokens); `outputs/research/demand-signals.md`
(DataForSEO raw); `outputs/research/options.md` (2026-06-27 architecture options citing the same
competitor set); cross-analysis `outputs/research/gtm-market-analysis-2026-06.md` (2026-06-29).

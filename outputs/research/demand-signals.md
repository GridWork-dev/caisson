# Demand signals — DataForSEO probe (Phase 2)

Reused prospector's DataForSEO adapter. Probe cost **$0.26**. Raw: `demand-data.json`.
US, Google Ads volume + CPC + competition, KD = keyword difficulty (0–100, lower = winnable).
**CPC is the willingness-to-pay proxy** (what advertisers pay per click = budget in the niche).

## Headline

1. **Compliance/regulated = the money.** 10–50× the CPC of every other cluster, at **low KD** (underserved SEO). These are high-budget B2B buyers and the category is not SEO-saturated.
2. **The compliance SERP is owned by finished platforms (Vanta, Drata, Sprinto, MetricStream, Cynomi) — NOT developer starter-kits or frameworks.** → picks-and-shovels gap: sell the framework to people _building_ compliance apps.
3. **Generic "saas boilerplate" is low-volume + brand-driven** (people search "shipfast"/"makerkit", not the category) → commoditized; viable only as the shared _base substrate_, not a headline SKU.
4. **Local-first AI = winnable SEO (low KD), real volume, lower CPC**; competitors are OSS frameworks (PowerSync, RxDB, inkandswitch) → open-core/community-led play (tessera is already AGPL), monetize via the license kit.
5. **AI/agent space = high volume, mid CPC, higher competition** ("claude code" 450K vol but KD 75 + branded; "ai agent framework" KD 32, langchain/microsoft/ibm own the SERP).

## Top niches by willingness-to-pay (vol × CPC, KD shown)

| Keyword                           | Vol/mo |      CPC |  KD | Cluster                |
| --------------------------------- | -----: | -------: | --: | ---------------------- |
| legal billing software            |  1,300 | **$261** |  41 | compliance/legal       |
| compliance automation software    |    480 | **$212** |  10 | compliance             |
| soc 2 compliance software         |    320 |     $171 |  28 | compliance             |
| legal document automation         |    140 |     $152 |   5 | compliance/legal       |
| blackline reconciliation software |    210 |     $148 |   0 | compliance/fin-ops     |
| automated billing software        |    390 |     $121 |   7 | compliance/fin-ops     |
| compliance management system      |    880 |     $112 |  18 | compliance             |
| policy management software        |    880 |     $106 |  12 | compliance             |
| contractor invoice software       |    480 |      $81 |   7 | compliance/fin-ops     |
| regulatory compliance software    |    480 |      $76 |  15 | compliance             |
| hipaa compliant software          |  4,400 |      $70 |  16 | compliance/health      |
| developer productivity tools      |    210 |      $56 |  12 | dev-tooling            |
| edge ai                           |  5,400 |      $24 |  29 | local-first AI         |
| ai coding agent                   |  4,400 |      $24 |  23 | AI/agent               |
| vector search                     |  1,600 |      $19 |  49 | AI-feature-add         |
| ai agent framework                |  1,300 |      $15 |  32 | AI/agent               |
| shipfast                          |    720 |      $26 |  10 | boilerplate (branded)  |
| private ai                        |  1,900 |    $4.33 |  23 | local-first AI         |
| on device ai                      |    480 |    $4.26 |   9 | local-first AI         |
| saas boilerplate                  |    140 |      $20 |  17 | boilerplate (category) |

## SERP competitor map (who ranks for the head term)

| Term                 | Top domains                                       | Read                               |
| -------------------- | ------------------------------------------------- | ---------------------------------- |
| compliance software  | Vanta, Usercentrics, Cynomi, MetricStream, Comply | finished platforms, no dev kits    |
| compliance saas      | Vanta, Drata, AppOmni, Sprinto                    | same — funded SaaS, not frameworks |
| audit trail software | Suralink, Datadog, Optro, InScope                 | platforms + observability          |
| local first software | inkandswitch, lofi.so, PowerSync, RxDB            | OSS sync frameworks                |
| on device ai         | Samsung, EDPS, Google Play, ondevice-ai.app       | hardware + consumer apps           |
| ai agent framework   | LangChain, Microsoft, IBM, Arize                  | big OSS/enterprise frameworks      |
| ai saas template     | Aceternity, Webflow, saaspo, Figma                | UI/design templates                |
| saas boilerplate     | GitHub, SaaSBold, SaaSStarters, SaaS Pegasus      | crowded boilerplate sellers        |

## Implication for the library

- **Lead with the compliance-grade framework** (highest WTP, gap in dev-tooling, your strongest baseline = Wardfile). The base-framework's multi-tenant-RLS + audit + WORM substrate is exactly what every compliance vertical (legal-doc, fin-ops/billing, policy-mgmt, SOC2, HIPAA) needs — one base, many verticalized templates.
- **Local-first AI as the open-core growth flank** (tessera) — community-led, license-kit monetized.
- **Generic SaaS substrate = the shared base, sold/bundled under the verticals — not its own hero product.**

# GTM + Market Reports — Gap / Insight / Conflict Analysis

Cross-reads the two **2026-06-27/28 Perplexity Computer** reports
(`gtm-customer-acquisition.md` · `market-competitive-analysis.md`) against Caisson's **current
locked state** (`docs/state/decisions-and-forks.md` + `knowledge/decisions/` ADRs +
`docs/build-state.md`). Produced 2026-06-29.

Each item is tagged **VALIDATES** (reports confirm a lock — no action), **GAP** (something
recommended that isn't built/decided), **CONFLICT** (report rec vs a _locked_ ADR — operator-owned
fork), or **INSIGHT** (new framing). Per the one-operator rule, every CONFLICT/material GAP is a
**recommendation + confidence + evidence**, not an auto-decision — forks routed to the picker.

## TL;DR

The reports **strongly validate the core strategy** (compliance wedge · production-rigor umbrella ·
own-the-code · update subscription · regulated-AI beachhead · MCP-first generator · evidence path).
The high-signal divergences are **three**:

1. **Pricing is the big one.** Both reports anchor **Compliance at $2,999–$4,999 + ~$1,499–$1,999/yr
   updates**; the current committed display is **~$1,299 Compliance / $599 AI-Kit / $2,499 bundle**
   — roughly **2–4× below** the research-recommended compliance-value anchor. _This reopens the one
   standing operator fork (final pricing) with strong new evidence._
2. **Open-core Base** — both reports recommend open-sourcing the non-differentiating Base as a
   trust/acquisition layer. Caisson **locked fully-commercial** (ADR-0023/0050/0083). Direct conflict.
3. **A free evaluation artifact** — the reports lean on a free **code sample / EU-AI-Act starter
   module** to replace a hosted trial. Caisson has **no free eval artifact** (Local-first went
   commercial). Gap (distinct from the open-core question).

Everything else is additive backlog (guarantee, comparison pages, Enterprise tier, auditor-trust
assets, content engine) or confirmation.

## 1. Strategy alignment — VALIDATES (no action, confidence: high)

| Current lock                                                                   | Report confirmation                                                                                                |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Hero = compliance wedge under a production-rigor umbrella (ADR-0040)           | Both: "Lead with Compliance under a production-rigor umbrella"; thesis "validated for regulated AI-heavy ICP"      |
| Own-the-code differentiation (whole positioning)                               | "compliance-as-code-you-own" is the named wedge                                                                    |
| Update-subscription model (ADR-0012)                                           | "Perpetual + updates = primary model"; updates = "regulatory insurance"                                            |
| Regulated-AI beachhead (specs/00)                                              | "Land regulated AI teams first: fintech, healthtech, legal AI, insurtech"                                          |
| MCP/agent-first `create-caisson` (ADR-0066/0076)                               | Rec #5: "Make MCP + agent rules first-class in create-caisson"                                                     |
| Evidence path: WORM · hash-chain · field-crypto · signed packs (ADR-0051–0058) | Rec #3: "Ship the EU AI Act evidence path: WORM logs, hash chain, keys, signed packs" (Caisson has these, partial) |
| Don't lead with Local-first; it's a module (ADR-0050/0083)                     | "Do not lead with Local-first… package it as a sovereignty/offline module"                                         |
| Agentic config emission engine-neutral (ADR-0066)                              | "Make engine-neutral config emission + MCP governance core… a feature of every edition"                            |

**Takeaway:** the locked architecture and positioning are the same product the market research
recommends building. No strategic pivot indicated.

## 2. Pricing — the standing fork, with new evidence (confidence: high)

Current committed display (ADR-0081 numbers, shown live per ADR-0082; final numbers still the open
ADR-0012 fork) vs the reports' recommendation:

| SKU                    | Current committed          | GTM report                  | Market report                        |
| ---------------------- | -------------------------- | --------------------------- | ------------------------------------ |
| Entry / Developer      | $99/mo (Developer)         | Starter $499 + $299/yr      | —                                    |
| Base / Standard        | (base not sold standalone) | Professional $999 + $499/yr | $999 + $499/yr                       |
| **Compliance (hero)**  | **from $1,299**            | **$2,999 + $1,499/yr**      | **$2,999–$4,999 + $1,499–$1,999/yr** |
| AI Production Kit      | from $599                  | (in bundle)                 | $1,499–$2,499 + $799–$1,199/yr       |
| Compliance + AI bundle | $2,499                     | $4,499 + $1,999/yr          | $6,999–$9,999 (full bundle)          |
| Compliance updates     | $199/mo                    | annual ($1,499/yr)          | annual ($1,499–$1,999/yr)            |
| Local-first AI         | commercial (TBD)           | —                           | $1,499–$2,999 + $799–$1,499/yr       |
| Agentic-Dev            | (roadmap)                  | —                           | $999–$1,999 + $499–$999/yr           |
| **Enterprise**         | **(none)**                 | —                           | **$9,999–$24,999+ / SLA**            |

**Reading:** the reports argue Caisson is **under-pricing the hero tier by ~2–4×**, anchored on the
Vanta/Drata TCO ($10K–$80K/yr SaaS alternative) and a modeled **~6× 2-yr LTV:CAC at the compliance
tier vs ~1.7× at standard**. They also prefer **annual updates** over the current **monthly** cadence
and **add an Enterprise/SLA tier**.

**Recommendation (med-high confidence):** revisit the final pricing fork now — at minimum raise the
Compliance anchor toward the $2,499–$2,999 floor and add an Enterprise/SLA tier — **before** the X-2
`@caisson/pricebook` numbers (ADR-0089) get baked at P6. _Caveat from the reports themselves:_ all WTP
figures are **assumptions** pending 20 ICP interviews + first sales; treat as directional. **Operator
fork — routed to the picker.** (Note: pricing _display_ is committed/live, ADR-0082, so a change is a
re-commit + a grandfathering decision, not a silent edit.)

## 3. CONFLICTS with locked ADRs (operator-owned — do NOT auto-decide)

| #   | Report rec                                                                                        | Locked position                                                                  | Confidence the report is right | Note                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Open-source non-differentiating Base** as trust/acquisition layer (both reports, market rec #4) | **Fully-commercial, no open/AGPL flank anywhere** (ADR-0023, ADR-0050, ADR-0083) | Medium                         | The strongest repeated external rec against a hard lock. Trade-off: open-core lowers acquisition friction + OSS-undercut risk, but reintroduces the copyleft/monetization-fence questions ADR-0083 deliberately closed. A real strategy fork.                                                      |
| C2  | **Annual** update subscription ($1,499–$1,999/yr)                                                 | **Monthly** compliance-updates SKU ($199/mo) per ADR-0081                        | Low-med                        | Mostly framing; $199/mo ≈ $2,388/yr already exceeds the annual rec. The reports prefer the annual _frame_ (regulatory-insurance renewal) over monthly churn optics. Cosmetic-to-moderate.                                                                                                          |
| C3  | **Free code sample / EU-AI-Act starter module** as the evaluation aid                             | No free tier anywhere (ADR-0083 killed the free Local-first flank)               | Medium                         | **Distinct from C1** — a free _sample/eval artifact_ is not a free _edition_. The reports treat "free code sample replaces hosted trial" as load-bearing for the funnel (Engaged→evaluation 20%). Caisson currently has nothing free to clone. Gap + soft conflict with the no-free-tier instinct. |

## 4. GAPS — recommended assets/features not yet built or decided

| #   | Gap                                                                                                                                        | Source                                 | Bucket                                | Confidence                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------- |
| G1  | **30-day money-back guarantee**, shown prominently                                                                                         | GTM pricing page + priority experiment | Site/commerce (P6 checkout)           | High — cheap, lifts pricing conversion                                              |
| G2  | **Free EU-AI-Act starter module / code sample** to clone                                                                                   | both reports (funnel evaluation step)  | Product + site (eval artifact)        | Med — see C3                                                                        |
| G3  | **Comparison pages** — Vanta vs Caisson, Makerkit vs Caisson                                                                               | GTM content pillar                     | SEO content (extends ADR-0079)        | High — high-intent SEO, not in the current SEO plan's named pages                   |
| G4  | **Enterprise / Support-SLA tier** ($9,999–$24,999+)                                                                                        | market pricing + business model        | Pricing + P6 support                  | Med — pairs with the support-bot (ADR-0009)                                         |
| G5  | **Auditor / legal trust assets** — published evidence schemas, legal-review letter, pilot case studies                                     | market threats (buyer-trust High)      | GTM/launch content                    | Med — the named mitigation for the #1 risk                                          |
| G6  | **Content engine** — EU AI Act Articles 9–15 checklist, Annex IV starter, WORM/hash-chain tutorials, LLM-FinOps guides, SOC2-in-a-monorepo | both reports (primary motion)          | Marketing content (docs-as-marketing) | High — this _is_ the primary GTM motion; `apps/site` docs surface exists to host it |
| G7  | **Sample evidence pack + architecture page** as trust proof on the pricing page                                                            | GTM pricing page                       | Site                                  | High — cheap, and the generator can emit a real one                                 |
| G8  | **Waitlist/launch seeding mechanics** (HN/PH drafts, 10–15 seeded ICP leads, founder-outbound list of 50 CTOs)                             | GTM launch strategy                    | GTM ops (operator)                    | Med — operator/founder motion, not code                                             |

## 5. INSIGHTS — new framing worth absorbing (no fork, confidence as noted)

- **I1 — Primary threat is the "compliance-is-service" objection, not AI codegen** (high). The copy
  must pre-empt "isn't this just what Vanta does?" by separating **GRC admin** (their job) from
  **app-level compliance engineering** (Caisson's). Sharpen `specs/04` / ADR-0080 messaging.
- **I2 — Timed regulatory hooks as launch milestones** (high): **Aug 2, 2026** EU AI Act
  transparency/enforcement; **Dec 2027** high-risk readiness. Anchor the content calendar + launch
  window to these dates.
- **I3 — No reliable keyword data exists** (high): both reports flag that the dev-kit long-tail SEO
  bet (ADR-0079) has **no validated volume** — commission Ahrefs/SEMrush before any paid SEO spend.
  A validation caveat on ADR-0079, not a reversal.
- **I4 — AI-gateway positioning** (med): compete on **portability** (vs Vercel AI Gateway) +
  **in-repo spend controls** (vs OpenRouter); **embed LiteLLM config** and **integrate Langfuse**
  rather than re-build. Sanity-checks the ADR-0059 gateway scope — don't rebuild observability.
- **I5 — ElectricSQL named "best Postgres-sync adapter candidate"** (low): Caisson built two-way sync
  in-house (ADR-0064). Not a reversal, but worth a note if the in-house sync proves costly — an
  ElectricSQL `SyncEngine` adapter is consistent with the ADR-0064 port.
- **I6 — MCP marketplaces as a 12–24 mo distribution channel** (med): reinforces the buyer-MCP +
  registry investment as a _distribution_ asset, not just a generator RPC (extends ADR-0076).
- **I7 — Unit economics gate the spend** (med): hold SDR/VP-Marketing/paid until WTP proven; weekly
  alarm <20 stars/wk, monthly <5 licenses/mo, quarterly CAC>$1,500 or activation<60%. A measurement
  cadence to wire into the cockpit when commerce ships.

## 6. Recommended next actions (sequenced; all operator-gated where they touch a lock)

1. **Re-open the pricing fork** with this evidence (picker) — set the Compliance anchor + decide the
   Enterprise tier **before** ADR-0089's `@caisson/pricebook` numbers are built at P6. _(G4, §2)_
2. **Decide C1 (open-core Base)** — the one repeated external rec against a hard lock; either
   reaffirm fully-commercial with a written rationale or open a new ADR. _(picker)_
3. **Decide C3/G2 (free eval artifact)** — a free EU-AI-Act starter module/sample is the funnel's
   evaluation step; decide whether to ship one (and whether it dents the no-free-tier stance). _(picker)_
4. **Backlog the additive gaps** (G1, G3, G5, G6, G7) into the P6/GTM content + checkout work — none
   conflict with a lock; G6 (content engine) is the primary motion and should be scheduled explicitly.
5. **Absorb the insights** (I1–I3) into `specs/04`/ADR-0080 copy + the ADR-0079 SEO plan as a
   messaging-sharpen + a keyword-validation caveat (doc-only, no fork).

## 7. Fork register (for the picker)

| Fork                                                                   | Recommendation                                                                 | Confidence                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------- |
| **Final pricing — raise the Compliance anchor + add Enterprise tier?** | Raise toward $2,499–$2,999 floor; add Enterprise/SLA; lock before P6 pricebook | Med-high                         |
| **Open-core Base (C1)?**                                               | Genuinely open — reaffirm fully-commercial OR open an ADR to reconsider        | Medium (reports favor open-core) |
| **Free EU-AI-Act eval module (C3/G2)?**                                | Lean yes — ship a free sample as the funnel evaluation aid                     | Medium                           |

_All other items (G1/G3/G5/G6/G7, I1–I7) are additive backlog or doc-only — no operator fork; they
land in the P6/GTM content plan + `docs/state/readiness-and-backlog.md`._

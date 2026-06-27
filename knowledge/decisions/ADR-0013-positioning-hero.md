# ADR-0013 — Hero positioning: compliance wedge under a production-rigor umbrella

Status: accepted · 2026-06-27 (positioning session — operator-locked at the positioning gate;
de-locked by D14, now closed). Supersedes the provisional "AI production codebase starter" frame.

Caisson runs a **two-layer positioning**:

- **Umbrella (the house):** a production-grade codebase library — _the load-bearing
  infrastructure cheap boilerplates skip._ The common enemy is **happy-path boilerplate**:
  everyone ships auth + Stripe + landing; nobody ships the parts that are load-bearing when you
  get audited, when the AI bill spikes, when a tenant's rows leak across RLS, when a regulator
  asks for evidence. One promise houses all four editions — no orphans.
- **Hero wedge (what acquisition leads with):** **Compliance.** It is the front door; the
  production-rigor umbrella is the house it opens into.

**Why compliance leads** (evidence, not preference): compliance CPC **10–50×** every other cluster
at **low KD** (winnable SEO, high-budget B2B buyers); the cleanest unserved gap, named unprompted
3× in the scan (_"no turnkey full-stack compliance starter"_ — RLS + WORM + audit chain);
Clynova proves WTP (compliance dev-kits clear **5–10× generic**, $999–1,999 one-time); the
strongest baseline (Wardfile rebuilt — 9/9/9/9 on baseline/defensibility/WTP/recurring,
`scores.json` 8.28); and the **compliance-update subscription** is the single strongest recurring
lever in the market. The SERP is owned by _finished platforms_ (Vanta/Drata), not dev-kits —
picks-and-shovels gap.

**Edition roles** (build scope unchanged — all four ship per D13; this fixes only the GTM weight):
Compliance = paid hero / front door · AI Production Kit = strongest #2 ("same rigor, AI infra";
intersects compliance via EU AI Act Annex IV) · Local-first AI = the **free AGPL flank**
(top-of-funnel awareness, not revenue) · Agentic-Dev = narrowest, post-wedge.

**ICP segments + buyer firewall (resolves review gap "market-strategy" #2 — D10 re-included
generic):**

- **ICP-1 (primary/hero):** the Compliance Builder — dev/founder/agency building regulated SaaS
  (SOC2/HIPAA/legal/fin-ops/health). Has the compliance budget; buys to skip 3–6 months of
  regulated-data plumbing and to be audit-ready.
- **ICP-2:** the AI-Product Engineer hitting the production wall (metering/spend-caps/eval/guardrails).
- **ICP-3 (flank):** the Local-first/Privacy Builder — enters via the **free AGPL** open-core, converts up.
- **Anti-ICP (refused at the paid hero tier):** the price-shopping "I just want a starter kit"
  generic-boilerplate buyer. Caisson does **not** compete with ShipFast for them. They enter
  **only** through the free AGPL flank; the compliance hero is never discounted to win them.

**Compliance-update subscription = its own SKU (resolves market-strategy #1; supersedes the single
subscription line in ADR-0012):** split into two products —

- **Compliance Updates — $149–299/mo** (ICP-1): auto-updating control mappings (SOC2/HIPAA/EU AI
  Act/DORA/NIS2/state-privacy) + evidence-pack regeneration + new-framework slots + drift alerts +
  compliance SLA. WTP ceiling = regulatory certainty. Market-validated band (compliance.tf $1K/yr,
  Archiet $419/mo, IronFort $299–359/mo, SchemaPilot $149–499/mo).
- **Developer — $49–199/mo**: monthly codegen + AI-feature credit allotment + private-registry
  pulls + new-edition access + priority dev support.

**EU AI Act Annex IV (resolves market-strategy #3):** a **gated paid add-on module**, not core.
v1 compliance **leads US frameworks (SOC2/HIPAA)**; EU AI Act ships à-la-carte + inside the
Compliance Updates subscription, enforced at the **license + registry entitlement** layer
(ADR-0008/0010/0004 — the code ships behind the registry token, stronger than a checkout flag).
Scaffold only an **empty named slot** in P2's compliance module registry now (≈ zero cost): it
lets the v1 page say "EU AI Act-ready" and gives the subscription a first paid upsell the day
demand shows; content is authored later, gated. **Sell worldwide** — EU AI Act binds the _buyer's_
regulator, not Caisson; our own EU VAT/data exposure is absorbed by the Merchant-of-Record. Do
NOT geo-restrict sales.

**Launch sequence, not a 4-way splash (resolves market-strategy #4):** Wave 0 = free local-first
AGPL (audience) · Wave 1 = Compliance paid hero (all marketing depth) · Wave 2 = AI Production Kit
then Agentic-Dev. **Hard gate at P2-exit:** the compliance edition must validate the
package-composition model and show real buyer signal before Wave 2 gets full GTM push; else narrow
the _launch_ (not necessarily the build) to Base + Compliance.

Rejected: **pure compliance hero** (orphans 3 editions for a solo operator with no audience — the
market-strategy review's #1 risk); **production-rigor umbrella co-equal** (vague — ShipFast/MakerKit
also claim "production foundation"; loses the specific budget-bearing entry); **local-first hero**
(WTP 5, OSS-crowded — it is the flank, not the hero); geo-restricting sales to dodge EU scope
(throws away the highest-urgency demand wave for zero benefit).

Binding: marketing leads compliance + production-rigor; the generic base is a one-line footnote,
**never** a comparison table. The Compliance Updates subscription is a distinct SKU from developer
credits. EU AI Act and every framework pack ship as **entitlement-scoped registry modules**, not
core. Launches sequence — no simultaneous four-edition splash; a P2-exit go/no-go gates Wave 2.
Voice + name: ADR-0014, `specs/04-voice-and-brand.md`.

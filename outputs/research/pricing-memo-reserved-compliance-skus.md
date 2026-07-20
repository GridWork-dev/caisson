# Pricing memo — three reserved-unpublished compliance SKUs

## Window

2026-07-20 — first-price round for three new Caisson compliance modules that shipped
today on reserved catalog ids (ADR-0371, "reserved ids now, price round later" —
sold-unpublished pattern; not sellable, not displayed, until this memo + an operator
price lock). Modules: `@caisson/access-review`, `@caisson/risk-register`,
`@caisson/trust-page`.

**This memo does not set a price.** Per doctrine, pricing FINAL adjustments stay
operator-owned (`~/lab/caisson/CLAUDE.md` "Still open"). Every number below is a range
with reasoning, never a single committed figure.

## Scope note (fanout deviation, disclosed)

The standard `gw-pricing-analyst` fanout is four-source (competitor scrape + PostHog
checkout funnel + Cookiy Van Westendorp WTP survey + PAL consensus). This run narrows to
**competitor scrape (exa) + internal catalog anchors + a PAL sanity-check chat**, per the
dispatching brief's explicit scope. Two sources are structurally empty for these three
SKUs, not just skipped:

- **PostHog checkout funnel** — these ids are not wired into `catalog.ts`'s
  `MODULE_PRICE_IDS` cart map yet (ADR-0371: "not sellable, not displayed"). There is no
  funnel to query — a `query-funnel` call would return zero rows, not signal.
- **Cookiy Van Westendorp survey** — no existing survey covers these three specific
  modules; standing one up (screener + 4-question price-sensitivity meter + a recruit
  pass) was out of the dispatching brief's explicit ask ("use exa web search"). Flagged
  as a Gap below, not fabricated.

Ran instead: one `mcp__pal__consensus`-class sanity pass (`mcp__pal__chat`,
`openai/gpt-5.2`) against the draft ranges before finalizing this memo — folded into
each module's Reasoning section below.

## Internal anchor set (source: `apps/site/lib/pricing.ts`, read 2026-07-20)

All 23 standalone modules run **$49–$299** one-time. The compliance-tagged subset
(`bundles` includes `"compliance"`) is the direct anchor for these three new modules:

| Module            | Price | Note                                          |
| ----------------- | ----- | --------------------------------------------- |
| audit-worm        | $149  | Append-only SHA-256 chain + WORM storage      |
| alerting          | $149  | Compliance CC7.2 alert pipeline               |
| field-crypto      | $199  | Per-tenant field encryption                   |
| retention-runner  | $199  | Policy-driven retention                       |
| signing-primitive | $199  | Detached Ed25519 + RFC-3161 signing           |
| frameworks-pack   | $249  | SOC2/HIPAA/EU-AI-Act mappings + OSCAL export  |
| compliance-core   | $299  | RLS-force collector + evidence-pack generator |

Median $199, mean ≈$206, range $149–$299. The **Compliance bundle** sells for **$1,049**,
which is **72.7%** of the $1,443 sum of these 7 members' standalone prices (the "below-sum
lock" per ADR-0258 — every bundle prices below the à-la-carte sum of its members).
`ADR-0012` (pricing model, 2026-06-27, still `status: proposed`) anchors the original
Compliance edition band at $899–$1,499, itself benchmarked against "Clynova compliance
$999–$1,999" — a comparable that predates this memo's own competitor research and reads
thin next to the live data below; treat ADR-0012's anchor as superseded context, not a
binding number.

## Module 1 — `@caisson/access-review` (access-review campaigns)

**What it is** (`outputs/specs/access-review-campaigns/SPEC.md`): a WORM-logged,
per-reviewee attested approve/revoke decision record over an imported
`MembershipSnapshot` (typed port; CSV/JSON adapters ship in v1). A `jobs`-riding
scheduling task opens a campaign on a cadence, closes it on completion or deadline
(undecided reviewees flagged `unresolved`, never auto-approved). **v1 has no live
IdP/SaaS connector** — a GitHub org/team connector is a named, not-yet-built v2
milestone. 675 LOC across 6 files — mid-sized, comparable in scope to `retention-runner`.

**Willingness-to-pay evidence — competitor price table**

| Vendor      | Where "access review" sits                                                                          | Price                                                                                   | Source (cited + dated)                                                                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vanta       | Gated feature — appears at **Plus** tier, absent from Essentials                                    | Essentials $7.5K–$12K/yr → Plus $20K–$45K/yr (the tier jump access reviews live behind) | [Vanta pricing breakdown](https://underdefense.com/blog/vanta-pricing/), published 2026-07-02; [vanta.com/pricing](https://www.vanta.com/pricing) feature matrix, retrieved 2026-07-20 |
| Secureframe | **Newly shipped flagship feature** — "User Access Reviews" launched as its own product announcement | Bundled into "Complete" tier (custom-quoted, $20K–$40K/yr band)                         | [Secureframe newsroom, "Announcing User Access Reviews"](https://secureframe.com/newsroom/announcing-user-access-reviews), published **2026-04-07**                                    |
| Drata       | Named capability — "User Access Review" appears at **Advanced** tier, absent from Foundation        | Foundation $7.5K–$15K/yr → Advanced $15K–$25K/yr                                        | [drata.com/plans](https://drata.com/plans) feature matrix, retrieved 2026-07-20                                                                                                        |

**Reading the signal:** all three category leaders gate access-review automation behind
a paid-tier upgrade worth **$10K–$30K/yr of incremental ACV**, and Secureframe treated it
as a launchable flagship feature four months ago — this is a hot, buyer-legible capability
category, not a commodity checkbox. That WTP is real but belongs to a different buyer
(a headcount-priced SaaS subscription, not a one-time code module a dev owns).

**Internal anchor fit:** 675 LOC, WORM-logged, jobs-riding — this sits at
`retention-runner`/`field-crypto` scope ($199), not at `compliance-core` scope ($299).
The missing live-connector layer (CSV/JSON only, v1) is the honest reason it doesn't
reach the top of the compliance band yet.

**Cross-vendor sanity check** (`mcp__pal__chat`, `openai/gpt-5.2`, 2026-07-20): pushed
back that a $199–$249 launch range may underprice the _concept_ given how hard
Vanta/Drata/Secureframe lean on access review as an upsell wedge, and suggested $249–$299
is defensible once the WORM-logged decision record reads as "audit-grade." Weighed
against the v1 non-goal (no live connector, no reviewer-facing UI) keeping scope closer
to a mid-tier module — the range below stays conservative at launch with an explicit
uplift trigger.

**RECOMMENDED RANGE: $199–$249** at launch (v1, CSV/JSON adapters only). **Repricing
trigger:** the GitHub org/team connector named as the SPEC's v2 milestone is the natural
point to revisit upward toward $249–$299 — a live-connector version closes the gap this
memo's own competitor evidence says the market pays a real premium for.

**Bundle candidacy:** Compliance (natural fit — audit-prep SOC2/ISO27001 evidence, same
persona as `audit-worm`/`retention-runner`). Not a fit for AI-Production, Local-first, or
Agentic-Dev (no cross-listing precedent for an audit-workflow module outside Compliance).

## Module 2 — `@caisson/risk-register` (general risk register)

**What it is** (`outputs/specs/general-risk-register/SPEC.md`): a framework-agnostic risk
register — `riskId, subject, likelihood, impact, residual (computed, never freeform),
treatmentPlan, owner, evidenceDigest`. An operator override of the computed residual is a
**WORM-logged exception record**, never a plain edit. Crosswalkable into any shipped
framework pack via the `crosswalk[]` pointer pattern. Exports a risk-treatment-plan
evidence-pack artifact. **Binding refactor:** the already-shipped EU-AI-Act risk collector
(`ai-risk-register.ts`) becomes an instance of this generalized schema — the golden-file
regression gets a dedicated SHIP review pass (ADR-0371). 885 LOC across 9 files — the
largest and most structurally load-bearing of the three (it's a dependency other
framework packs crosswalk into, not a leaf module).

**Willingness-to-pay evidence — competitor price table**

| Vendor                 | Segment                                                                                                  | Price                                                                                                               | Source (cited + dated)                                                                                                                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LogicGate (Risk Cloud) | Enterprise GRC — ERM application, seat-licensed                                                          | ERM app alone: $40K–$55K/yr list, $32K–$42K negotiated; typical small deployment (1–3 apps) $25K–$45K/yr all-in     | [LogicGate Risk Cloud pricing benchmark](https://vendorbenchmark.com/vendors/logicgate-risk-cloud-pricing), published 2025-11-21; [Vendr LogicGate marketplace](https://www.vendr.com/marketplace/logicgate), retrieved 2026-07-20 |
| Riskonnect             | Enterprise IRM — ERM module, per-user                                                                    | $900–$1,600/user/yr at the 250-user band                                                                            | [Riskonnect pricing benchmark](https://vendorbenchmark.com/vendors/riskonnect-pricing), published 2026-02-06                                                                                                                       |
| Vanta                  | Gated feature — "Risk management with customization, dashboard, reporting" at **Professional** tier only | Professional $80K–$250K/yr (vs. Plus $20K–$45K/yr — risk management with customization is a Professional-only line) | [Vanta pricing breakdown](https://underdefense.com/blog/vanta-pricing/), published 2026-07-02                                                                                                                                      |

**Reading the signal:** dedicated risk-register/ERM tooling is consistently the
**highest-priced line item** across every GRC vendor surveyed — it's seat- or
app-licensed enterprise software, a structurally different buyer than Caisson's
dev-founder. The comparison is directional (proves the category commands real budget,
including inside Vanta's own tier ladder where it's reserved for the _top_ tier) rather
than a literal per-unit comp.

**Internal anchor fit:** at 885 LOC this is the largest of the three modules and the only
one that's a genuine cross-cutting _dependency_ — every framework pack crosswalks into
it, and it absorbs a refactor of a shipped, revenue-bearing collector. That puts it at
parity with `frameworks-pack` ($249) to `compliance-core` ($299), not the mid-band
($149–$199) other single-purpose compliance modules occupy.

**Cross-vendor sanity check** (`mcp__pal__chat`, `openai/gpt-5.2`, 2026-07-20): agreed
this is "the cleanest fit at the top of the band" given LOC, cross-framework integration,
computed residuals, WORM exceptioning, and the shipped-collector refactor — "wouldn't go
below $249."

**RECOMMENDED RANGE: $249–$299.**

**Bundle candidacy:** Compliance (primary fit — feeds the EU-AI-Act collector already in
that persona's scope). Secondary candidate: Provenance, given the WORM-logged exception
chain overlaps that bundle's crypto-provenance theme — but Provenance's current members
(`audit-worm`, `field-crypto`, `signing-primitive`) are infra primitives, not workflow
modules; risk-register reads more like a Compliance-native capability. Recommend
Compliance-only at launch.

## Module 3 — `@caisson/trust-page` (buyer-facing trust/status page generator)

**What it is** (`outputs/specs/trust-page-generator/SPEC.md`): a static-site/JSON
generator that renders the buyer's evidence pack + crosswalk rollup into a
self-contained deployable page the buyer hosts themselves. Redaction is
**allowlist-based** (a field absent from the allowlist never renders — denylists
rejected as a leak class). **Binding, permanent non-goals:** no auth, no reviewer
sign-off, no hosted comments, and an NDA-gated variant is explicitly ruled out forever —
any of those would make it "the wrong-class portal under a different name." Explicitly
distinct from Caisson's own `/trust` page. 310 LOC across 7 files — the smallest and
thinnest of the three by a wide margin.

**Willingness-to-pay evidence — competitor price table**

| Vendor                                         | Product                                                                                                                                       | Price                                                                                                              | Source (cited + dated)                                                                                                                                                                                                           |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SafeBase (now "Drata Trust Center")            | Standalone hosted trust-center SKU                                                                                                            | $5,000+/yr floor; $8K–$15K/yr typical                                                                              | [AuditXYZ SafeBase review](https://www.auditxyz.com/tools/customer-trust/safebase), retrieved 2026-07-20; [Cyberbase "What Is a Trust Center?"](https://www.cyberbase.ai/blog/what-is-a-trust-center-2026), published 2026-05-04 |
| Vanta                                          | Trust Center add-on (Plus tier) / Trust Center Advanced (AWS Marketplace SKU)                                                                 | $3K–$8K/yr add-on; AWS Marketplace list: Trust Center $6,000/yr, Trust Center Advanced $10,000/yr (1–20 employees) | [AWS Marketplace — Vanta](https://aws.amazon.com/marketplace/pp/prodview-5ophamrbfxt44), retrieved 2026-07-20                                                                                                                    |
| Drata (SafeBase-derived, "Drata Trust Center") | Trust Center Pro (post-SafeBase-acquisition unification, March 2026)                                                                          | $8K–$15K/yr standalone; median ACV ~$25K/yr when bundled with the GRC platform                                     | [Drata pricing 2026 breakdown](https://www.orbiqhq.com/comparisons/drata-pricing), published 2026-04-02                                                                                                                          |
| Cyberbase (disruptor)                          | Free trust-center tier — explicit thesis that the $8K–$15K/yr category price is "a legacy pricing decision waiting for someone to disrupt it" | $0                                                                                                                 | [Cyberbase, "What Is a Trust Center?"](https://www.cyberbase.ai/blog/what-is-a-trust-center-2026), published 2026-05-04                                                                                                          |

**Reading the signal:** this is the **highest per-unit competitor WTP** of the three
modules ($5K–$20K/yr is the most consistent number across every source) — but it's also
the module built to deliberately **not** replicate what that price buys. The competitor
product is a hosted, NDA-gated, auth-walled portal with viewer analytics and an AI
questionnaire assistant; Caisson's version is a static generator the buyer deploys
themselves, with hosting/auth/NDA-gating named as _permanent_ non-goals. Pricing at
parity with the $5K–$20K/yr category would overclaim capability the SPEC explicitly
refuses to build. The Cyberbase free-tier entrant is independent evidence the category's
premium is already compressing from below — a second reason not to anchor high.

**Internal anchor fit:** at 310 LOC, this is materially thinner than the other two
modules and thinner than most of the compliance band. It sits closest to
`audit-worm`/`alerting` ($149) rather than `frameworks-pack`/`compliance-core`. The
"one-time, own the code, no subscription" framing is itself the pitch against a category
whose entire cost structure is recurring — that's worth a modest premium over the
absolute utility-tier floor ($49–$99), not parity with the category it's disrupting.

**Cross-vendor sanity check** (`mcp__pal__chat`, `openai/gpt-5.2`, 2026-07-20): agreed
the discount relative to trust-center SaaS pricing is correct given the explicit
non-goals, and flagged the temptation to price higher off the SaaS WTP number as a trap —
"your product is intentionally 'static generator,' so $149–$199 is appropriately
'developer tool' priced."

**RECOMMENDED RANGE: $149–$199.**

**Bundle candidacy:** Compliance (primary — consumes the evidence pack + crosswalk
rollup that only exists inside that persona). No fit elsewhere; it has no standalone
utility outside a compliance program.

## Compliance-bundle coherence — the dilution flag

If these three modules join the Compliance bundle's `bundles[]` membership at launch, the
bundle's price-vs-subtotal math changes materially. Current state: $1,049 bundle price /
$1,443 member subtotal = **72.7%**.

| Scenario                                         | New member subtotal (7 existing + 3 new) | Bundle price           | Ratio | Read                                                                                                                                                                                                                                                        |
| ------------------------------------------------ | ---------------------------------------- | ---------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Low-end new-module prices ($199+$249+$149=$597)  | $2,040                                   | $1,049 (**hold**)      | 51.4% | Bundle discount looks dramatically deeper — good upsell math (`buildStackSummary`'s nudge fires harder), but standalone sales of all three new modules are cannibalized: nobody pays $249 for risk-register alone when the whole 10-module bundle is $1,049 |
| High-end new-module prices ($249+$299+$199=$747) | $2,190                                   | $1,049 (**hold**)      | 47.9% | Same dilution, worse                                                                                                                                                                                                                                        |
| Low-end prices, ratio held at ~73%               | $2,040                                   | **≈$1,489** (**bump**) | 73.0% | A $440/42% bundle price increase over the current committed $1,049                                                                                                                                                                                          |
| High-end prices, ratio held at ~73%              | $2,190                                   | **≈$1,599** (**bump**) | 73.0% | A $550/52% bundle price increase                                                                                                                                                                                                                            |

**Two real options, both operator-owned:**

1. **Hold the bundle at $1,049, and don't add these three to `bundles[]` at launch.**
   Sell them standalone-only until real conversion data exists, then revisit bundle
   membership + bundle price together in a later round. Lowest-risk — matches ADR-0371's
   own posture ("site depth pages wait for the price lock") and avoids repricing a
   committed, already-displayed number based on new modules nobody has bought yet.
2. **Add them to the bundle and bump the bundle price** to something in the
   **$1,449–$1,599** band to hold the ~73% below-sum ratio. This is a genuine price
   increase on an existing, live, purchased SKU — `ADR-0012`'s binding clause
   ("price changes grandfather existing buyers") means past buyers keep their $1,049
   entitlement; only future buyers see the new number. `ADR-0082`/`ADR-0130`'s honesty
   floor means this reads as a clean new price, not a struck-through "was/now" — no
   compliance issue, just an operator call on whether a 42–52% bundle price move is
   wanted this cycle.

**The Everything bundle needs no decision either way.** `everythingSavings()` in
`apps/site/lib/pricing.ts` computes savings live as `moduleCatalogSubtotal() -
everything.amount` — adding these three modules to the sellable catalog automatically
increases Everything's advertised real savings figure with zero code change and zero
coherence risk. If the operator wants a free, mechanically-honest reason to greenlight
the standalone SKUs before touching the Compliance bundle at all, this is it.

## Findings

### 1. Access-review is the SPEC most likely to be underpriced at the conservative end

- Evidence: Vanta/Drata/Secureframe all gate it behind a $10K–$30K/yr tier jump;
  Secureframe launched it as a standalone flagship product four months ago
- Confidence: medium — the WTP signal is strong but belongs to a subscription-SaaS buyer,
  not Caisson's one-time-code buyer; v1's no-live-connector scope is a real, honest cap

### 2. Risk-register is the clearest top-of-band placement of the three

- Evidence: largest LOC, only cross-cutting dependency (crosswalk pointers + shipped
  EU-AI-Act refactor), GRC category consistently commands the highest competitor pricing
  of any surveyed segment
- Confidence: high

### 3. Trust-page is correctly the cheapest of the three despite the highest competitor $ signal

- Evidence: SPEC's permanent non-goals (no auth/NDA/portal) deliberately build a thinner
  product than the $5K–$20K/yr category it's adjacent to; smallest LOC; a free disruptor
  entrant is independently compressing that category's price ceiling
- Confidence: high

### 4. Adding these three to the Compliance bundle without a bundle repricing dilutes per-module value by ~20 points of ratio

- Evidence: bundle ratio math above (72.7% → 47.9–51.4% if bundle price holds)
- Confidence: high (arithmetic on live `pricing.ts` data) — the _decision_ (hold vs. bump
  vs. defer bundle membership) is operator-owned, not a finding with a right answer

## Gaps

- **PostHog checkout funnel** — not queryable; these ids aren't wired into
  `catalog.ts`'s cart maps yet (pre-price-lock, per ADR-0371). No funnel exists to read.
- **Cookiy Van Westendorp WTP survey** — no existing survey covers these three modules;
  standing one up was out of this dispatch's scope (exa-only research requested). If the
  operator wants a direct WTP read from Caisson's actual buyer population before locking
  a number, this is the highest-value follow-up — a 4-question price-sensitivity meter
  per module, run against the existing buyer list or a targeted recruit.
- **Linear liveness / project doc** — not checked, not written. The dispatching brief
  scoped this run to a single git-committed memo file only ("the memo is your only
  artifact"); no Linear project doc was created for this pass.
- **PAL full consensus** (multi-model roster) — ran a single-model `pal chat` sanity pass
  (`openai/gpt-5.2`) instead of the full `mcp__pal__consensus` multi-model debate, given
  the scope of this dispatch. A second model's read would strengthen confidence further
  if the operator wants it before locking.

## Operator decides

None of the three ranges above is a committed number: **access-review $199–$249**
(repriceable upward once the GitHub connector ships), **risk-register $249–$299**,
**trust-page $149–$199**. The Compliance bundle question — hold at $1,049 and defer
membership, or bump to $1,449–$1,599 and include all three now — is a separate,
equally operator-owned fork. This memo does not set a price. Final call is
operator-owned.

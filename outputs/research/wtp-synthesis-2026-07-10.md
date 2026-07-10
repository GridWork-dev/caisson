# Caisson WTP + Positioning Synthesis — 2026-07-10

**Program:** pre-launch pricing validation (full-evidence follow-up to ADR-0304/0305)
**Inputs:** 12 AI-moderated ICP interviews · 2 Cookiy quant surveys (frame 776545 n≈42 · Van Westendorp 445432 n≈27)
**Binding posture:** this document decides nothing. Every pricing implication below is a labeled recommendation with a confidence level and cited evidence, routed to `docs/state/decisions-and-forks.md` for the operator to lock or reject. Anchors stay as locked by ADR-0304 ($1,049 / $2,059) until an operator lock says otherwise.

---

## Executive read

The current $1,049 Compliance anchor is validated as reasonable-to-cheap: of the ten interviewees who heard the real number, nine reacted neutral-to-strongly-positive (three unprompted "no-brainer / extremely attractive / sweet spot" reactions), and the anchored survey ladder confirms it — 56% acceptance across the full panel, 70% among ICP-fit respondents. The one dissent ran the *opposite* direction from the risk we were guarding against: an enterprise DX lead read $1,049 as a "lowball" that undercut perceived enterprise-grade credibility, so the live tension around the Compliance price is under-pricing/credibility, not price resistance. The $2,059 Everything anchor is the least-validated number in the program — it was probed in zero interviews, and the nearest survey rung ($2,499) drew 70% rejection, so it should be treated as HOLD-but-unverified pending a direct read. On positioning, platform-first framing (Frame B) wins on _clarity_ in both the survey (45% vs 17%) and the interview split, but compliance remains the _click-through hook_ — the pattern the current locked hero (ADR-0040, "compliance wedge under a production-rigor umbrella") already encodes, so the evidence validates the existing frame rather than overturning it. The single most consistent unmet need across both surveys and the interviews is third-party proof — testimonials, case studies, working demo, and owned-source/code access — which points the about-to-launch design-partner program directly at its highest-value deliverable. Two concrete copy gaps surfaced: Frame A names SOC 2 / HIPAA but real buyers repeatedly need PCI DSS, GDPR, and ISO 27001 (a stated dealbreaker for one), and per-org/no-seat licensing was never actually tested even though buyers arrive with per-seat mental models it could contrast against. Both survey instruments are panel-quality-compromised (off-ICP recruitment, nonsense free-text, extreme outliers), so all quantitative reads are directional only and the open-ended Van Westendorp curves are unusable. Net: hold the anchors, fix the standard-naming copy, feed the proof gap into design partners, and re-run pricing against a screened panel before any anchor move.

---

## Evidence base (what ran, n, caveats)

### Qualitative — 12 AI-moderated interviews

Real ICP-adjacent respondents (technical founders / eng leaders / regulated-startup staff), one guide (product description, two positioning frames, $1,049 Compliance anchor reveal, in-house-build reframe). Distribution of engagement quality was wide.

| #   | Interview id | Persona (short)                                | Stack                 | Compliance regime         | Buy signal | Frame pick                      | Heard $1,049?            |
| --- | ------------ | ---------------------------------------------- | --------------------- | ------------------------- | ---------- | ------------------------------- | ------------------------ |
| 1   | 019f4a2e     | Dev/PM, localization SaaS                      | Node (vague)          | none named                | moderate   | A                               | yes                      |
| 2   | 019f4a5a     | Founder, TrustChain (Solana security)          | React→TS              | none targeted             | moderate   | A (personal); B converts more   | yes                      |
| 3   | 019f4ad6     | Dev, golf-tournament SaaS                      | RoR + TS              | GDPR, PCI DSS             | moderate   | B                               | **no** (own anchor only) |
| 4   | 019f4aef     | Non-dev analyst, tax/accounting SW             | —                     | tax/legal (unnamed)       | weak       | A                               | yes                      |
| 5   | 019f4af4     | Manager, laptop-HW manufacturer                | loose TS/Node         | GDPR only                 | weak       | B                               | **no** (never revealed)  |
| 6   | 019f4b0d     | Co-founder, EU EUDR-compliance SaaS            | TS/Node + Sage        | EUDR (product-core)       | **strong** | B wins compare / clicks A first | yes                      |
| 7   | 019f4b27     | Tech director, UK ERP/web-services             | in-house TS           | PCI DSS + GDPR + ISOs     | moderate   | A                               | yes                      |
| 8   | 019f4b38     | Product/CFO-committee, EU efficiency + royalty | TS/Node SQL           | GDPR+SOC2+PCI+ISO27001    | **strong** | B                               | yes                      |
| 9   | 019f4b64     | Non-tech ops, AI recruitment platform          | (defers to CTO)       | GDPR, →HIPAA              | weak       | B                               | yes                      |
| 10  | 019f4b6b     | Head of architecture, car-rental SaaS          | .NET Core + TS subset | GDPR only (deprioritized) | moderate   | B                               | yes                      |
| 11  | 019f4b76     | Eng/product, CX/social-listening SaaS          | Node/Java/Python      | GDPR (30-day)             | **strong** | A (strongest wedge validation)  | yes                      |
| 12  | 019f4b9b     | DX/tooling lead, ~30yr enterprise ITSM SaaS    | SQL + JS/V8 + TS      | GDPR + annual ISO 27001   | weak       | B                               | yes                      |

Buy-signal tally: **3 strong (6, 8, 11) · 5 moderate (1, 2, 3, 7, 10) · 4 weak (4, 5, 9, 12)**. Frame tally: **A = 5 (1,2,4,7,11) · B = 6 (3,5,8,9,10,12) · 1 split (6)**.

**Caveats:**

- **Pre-guide-fix (flagged per binding rule d):** interview **1 (019f4a2e)** predates the interview-guide fix. Its licensing probe asked only about the flat 40%-of-bundle renewal (which the respondent accepted), never per-org-vs-per-seat mechanics. It is also a low-technical-depth / low-effort respondent by the analyst's own read ("Node… towards the end of development," "multi tool database… the usual stuff") — treat _every_ finding from it as lower-confidence, not only the licensing item.
- **$1,049 not shown to interviews 3 and 5** — their "price" reactions are to self-generated anchors, not to Caisson's real number. Do not fold them into the $1,049 acceptance count.
- **$2,059 Everything anchor was NOT presented or probed in a single interview.** No qualitative read exists for it.
- **Weak-fit personas:** #5 (physical-hardware manufacturer, loose non-strategic TS) and #4/#9 (self-disclaimed non-buyers deferring to architecture/CTO) are off the tight ICP; keep their signals separate from the eng-leader core.

### Quantitative — two Cookiy surveys

- **Frame survey 776545 (n=42, 100% completion):** positioning-preference + single point-price-expectation per frame. **Off-ICP:** 66.7% self-classified "Other," only 33% (14/42) mapped to any Caisson persona, one samplicio.us panel-router referral, several nonsense free-text answers ("Sgrbsvr," "Ygghgh," profanity). Price fields ($100 median, mean wrecked by a 36.25M outlier) are **unusable for pricing** — read only as a panel-mis-targeting flag.
- **Van Westendorp survey 445432 (n=27, 100% completion, ran 07-07→07-10):** open-ended TC/CH/EX/TE block **plus** a 4-point reaction ladder anchored at the real prices $649/$1,049/$1,499/$2,499. Same panel-quality problems (samplicio.us referral, $0/$0/$0/$0 row, $1B "too cheap," obscene free-text). Only 10/27 (37%) ICP-fit; only 12/27 gave ordinally valid VW answers, 8 after trimming.

**Sample-size caveats on the VW read (binding rule e):** every cut is thin — n=27 overall, **ICP n=10** (each respondent = 10 points of any ICP stat), ordinally-valid n=12, trimmed n=8. None clears a floor for a standalone pricing decision. The **open-ended VW curves are not usable** (see next-but-one section). The **anchored ladder is the trustworthy instrument** in the dataset and is what the pricing reads below rest on. $2,059 was **never asked** — the closest rung is $2,499, so every Everything read is an extrapolation, not a measurement.

---

## Segments observed

**SAYS (from the data):**

- **Regulated eng-leaders (the core ICP)** — #6, #7, #8, #11: named regimes (EUDR / PCI DSS+GDPR+ISO / SOC2+PCI+ISO27001 / GDPR), technical buyers, real budget authority or committee seats. This is where the strong buy signals cluster (3 of 4 strong-buy interviews) and where the survey's ICP cut is ~23 points more price-tolerant at every ladder rung.
- **Feature-first technical buyers** — #10, #12: compliance is a roadmap item, not today's pain; they buy for platform completeness and "own your code" independence, and pick Frame B. #12 additionally carries a strong pre-existing supply-chain-security posture (won't pull from public registries) that motivates owned-source independently of compliance.
- **Non-buyer proxies** — #4, #9: explicitly outside procurement/eng; useful for framing comprehension and objection texture, not for WTP.
- **Off-ICP / weak-fit** — #5 (hardware, loose TS); a persona mismatch that is itself a data point about who _not_ to recruit.
- **Survey ICP-fit segment (both surveys):** consistently the _least_ price-resistant slice — 70% accept $1,049 vs 47% non-ICP; still 50% acceptance at $1,499. The gap holds directionally at every rung.

**INFER (my read, not stated):**

- The real buyer tolerates the current price better than the noisy topline implies; the general-panel numbers drag the average down because the panel is mis-targeted, not because the ICP resists the price. Confidence in this inference is medium — it rests on an n=10 ICP cut.
- The strong-buy cluster is disproportionately buyers for whom **compliance is customer-facing product surface** (#6 EUDR monitoring, #11 field-encryption/tenant-isolation as a feature), not just an internal audit chore. That is a recruitment signal for design partners, below.

---

## WTP findings vs the locked anchors (per-bundle where evidence exists)

### Compliance bundle — $1,049 (ADR-0304 HOLD)

**SAYS.** Unprompted price expectations _before_ the reveal spanned two orders of magnitude — $450–500 (#1), "a few hundred" (#2), $500–1,000 (#3), ~€250/mo SaaS ≈ low-thousands/yr (#8), ~$1,000 (#10), $3,000/server one-time (#11), $2,000–10,000 agency-build (#7), $100k full-platform (#6), tens-of-thousands/yr GRC (#12). On hearing $1,049, the ten who heard it reacted:

- **Strongly positive / price-shock:** #6 ("_Wow… way cheaper than I would assume… it keeps a no brainer_"), #8 ("_Extremely attractive_"), #11 ("_sits right in the sweet spot for midrange… a very realistic budget_").
- **Positive, gated on a condition:** #7 ("_a very good price… a lot lower than what I would think_" — then gated on GDPR/PCI DSS coverage), #10 ("_surely very interesting_"), #2 (conditionally fair _if_ the bundle is complete and not upsell-laden), #9 ("_that's really good_," hedged by billing-cadence confusion).
- **Neutral→acceptable after adding value:** #1 ("a little high" → "reasonable" after the build-time/funding-risk reframe), #4 ("a bit expensive" → "acceptable" only once human support was hypothetically bundled).
- **Negative in the low direction:** #12 ("_sounds possibly too good to be true… it does feel like a little bit of a lowball_") — anchored against GRC platforms "in the tens of thousands of pounds per year."

Ladder confirmation (survey 445432, anchored, trustworthy): **$1,049 → 56% net acceptance / 37% flat rejection** full panel; **70% acceptance among ICP-fit (n=10)**. Largest single full-panel bucket (40.7%) is "expensive but would consider," i.e. worth-it-not-cheap.

**INFER.** $1,049 sits inside a defensible band and at or below true ICP WTP; the dominant deviation is "cheaper than expected," and the only real-buyer objection to the _number itself_ runs low (credibility), not high. There is a plausible headroom signal, but it is confounded by small n and panel quality — do **not** read it as a mandate to move the price. (Recommendation R1 / R7 below.)

### Everything bundle — $2,059 (ADR-0304 HOLD)

**SAYS.** No interview evidence — never presented. The nearest anchored survey rung, **$2,499, drew 70% rejection** (both segments; ICP still 30% accept vs non-ICP 18%). $1,499 is the ladder's coin-flip (44%/44%).
**INFER.** The Everything zone is where rejection becomes dominant for this panel, and $2,059 is the single least-validated anchor in the program. This is not evidence to move it — $2,059 ≠ $2,499 and the panel is off-ICP — but it is a clear signal to **measure it directly** before launch confidence. (Recommendation R2.)

### AI-Production $739 · Local-first $629 · Agentic-Dev $329 · Provenance $399

**SAYS.** Zero direct evidence — no interviewee or survey rung addressed these bundles.
**INFER (low confidence).** The unprompted single-bundle anchors clustered at $500–1,000, and the validated Compliance ceiling sits above all four; so $329–$739 plausibly sits comfortably under demonstrated WTP. This is inference from the Compliance read, not a measurement — flag as a gap, not a validation.

### Subscriptions — Developer $499/yr · Compliance-Updates $1,499/yr · the 40% update-window renewal

**SAYS.** The 40%-of-bundle renewal ($420/yr on Compliance) is the *only* concrete price objection anywhere: #11 — "*renewal… forty percent, four hundred twenty is a bit higher than the software industry average… standard software licensing and maintenance is usually fifteen to twenty percent… Forty is a bit aggressive*" — but negotiable, "*if we were to sign for three years and… some discounts possible… I'd be down for it.*" #1 accepted the same 40% without scrutiny; #9 needed the patches-after-year-1 mechanic explained before it registered. #12 (perpetual-own-outright buyers) *expects* "an annual support subscription payment on top." Compliance-Updates' $1,499/yr number coincides with the ladder's $1,499 coin-flip rung (44% accept) — but the ladder tested one-time bundle reactions, not a subscription, so treat that as coincidental context, not a subscription read.
**INFER (low-med).** Developer $499/yr looks cheap against #12's $90/user/mo (=$1,080/user/yr) Claude Code Team benchmark; no direct read. The 40% renewal is defensible to informed buyers but sits visibly above the 15–20% maintenance norm one buyer named — a soft edge worth a justification line or a multi-year discount lever, not a cut. (Recommendation R6.)

---

## Van Westendorp read

**The open-ended 4-question VW block is not decision-grade and must not be reported as a price range.** Across all three sample cuts (all-27, ordinally-valid n=12, trimmed n=8) the mechanical crossings converge tightly in the **$10–$41** band:

- Point of Marginal Cheapness ≈ $11–$20
- Point of Marginal Expensiveness ≈ $40–$41 (suspiciously stable — the whole panel was mentally pricing a sub-$50 item)
- Indifference Price Point ≈ $20–$25
- Optimal Price Point ≈ $16–$38 (least stable)

The convergence at ~1/50th of the real anchor is the _tell_ that the instrument measured the wrong thing: the dollar prompt was never anchored to $1,049 before the open-ended questions, so respondents guessed at a generic "software bundle," and over half the sample (15/27) gave non-monotonic ladders that violate the method's premise. **Reporting these figures to stakeholders as Caisson's acceptable range would read as "cut price 95%+," which is a survey-mechanics artifact, not willingness-to-pay.**

**Use the anchored ladder instead** (same survey, real prices):

| Price      | Fair  | Would consider | Too cheap | Too expensive (reject) | Net acceptance            |
| ---------- | ----- | -------------- | --------- | ---------------------- | ------------------------- |
| $649       | 55.6% | 14.8%          | 7.4%      | 22.2%                  | **70.4%**                 |
| **$1,049** | 14.8% | 40.7%          | 7.4%      | 37.0%                  | **55.6%**                 |
| $1,499     | 25.9% | 18.5%          | 11.1%     | 44.4%                  | **44.4%** (tipping point) |
| $2,499     | 11.1% | 11.1%          | 7.4%      | 70.4%                  | **22.2%**                 |

Reconstructed directional acceptable band: **~$650–$1,400 for the general pool, extending toward ~$1,500 for the ICP-fit segment.** $1,049 sits inside that band, closer to its upper edge for the broad panel and comfortably inside it for the actual buyer persona. The $2,059–$2,499 zone is where rejection dominates.

**Sample-size caveats (binding rule e), restated:** ICP n=10, ordinally-valid n=12, trimmed n=8, whole survey n=27 — every stat here is directional; ±10-point swings per respondent in the ICP cut. $2,059 is extrapolated from the $2,499 rung, not measured. Re-run with a screened panel and front-loaded price context before treating any of this as a launch gate.

---

## Positioning frame results

**SAYS.**

- **Survey (776545, n=42):** Frame B ("full platform, compliance as flagship") beat Frame A ("leads with compliance") **45.2% vs 16.7%**, with 38.1% no-difference. The driver is **clarity, not compliance appeal** — 71.4% called B "clear" vs 47.7% for A; explore-appeal was near-tied (52.4% vs 50.0%). Open-text "why" answers cite plain language / less jargon for B, not the compliance pitch. Even in the self-identified compliance segment (REG=Y, n=12) B still won 58% vs 33% — "lead with compliance" did not clearly outperform _even with its own target audience_ (though n=12 is untrustworthy).
- **Interviews:** a near-even 5 A / 6 B / 1 split. The split case is the load-bearing one: #6 rated **Frame B more compelling in the head-to-head** ("_it has AI compartment and has six different stuff… will be very relevant_") **but said they'd click the compliance-led Frame A first from a landing page.** The strongest compliance-wedge validation, #11, chose A and asked to hear it twice, naming "_HIPAA prep built into the product's foundations_" and "_field-level encryption_" as the standout claims. #2 chose A for personal clarity but estimated B "_would probably capture sixty or seventy percent more people._"

**INFER.** The two data streams reconcile cleanly: **platform-first wins comprehension; compliance-first wins the click.** That is exactly the locked hero posture (ADR-0040: compliance wedge under a production-rigor umbrella) — so the evidence _validates the current frame_ rather than arguing for a flip to pure-platform or pure-compliance. The actionable move is not a re-pick of A-vs-B but tightening B's plain-language comprehension while keeping compliance as the entry hook and flagship claim. Confidence medium-high (two instruments agree, but the survey panel is off-ICP and the interview split is small).

**Copy gap (SAYS, high-signal):** Frame A's copy names SOC 2 / HIPAA, but the regulated buyers repeatedly need **PCI DSS, GDPR, ISO 27001**. #7 made it an explicit dealbreaker: "_The biggest deal breaker is just if it doesn't meet those requirements that we've got around GDP[R] on PCI DSS… I couldn't explicitly see that mentioned._" #6, #8, #10, #11, #12 all named GDPR/PCI/ISO regimes, none led with HIPAA. The named-standard _recognition_ is what creates resonance ("_household recognized names… straight away dragged your attention_," #7) — so naming the wrong ones is a direct conversion leak.

---

## Per-org no-seat licensing reaction

**SAYS.** Per-org/no-seat mechanics were **never directly tested in any of the 12 interviews.** The closest probes:

- **#1 (pre-guide-fix, flagged):** only the flat 40% renewal was asked; accepted. No seat/org question.
- **#3:** self-initiated "_Is this a one time payment or a monthly payment?_"; moderator confirmed one-time + 12 months updates. No seat/org reaction.
- **#9 (the fullest probe):** the 12-months-updates / code-works-forever / patches-only-after-year-1 structure was explained; reaction went confusion ("_does that mean… it's a yearly subscription and also the code works forever… continuous updates?_") → reassurance once patches-continue was clarified. **Per-org/no-seat terminology was still not raised.**
- **#11, #12:** perpetual-own-outright framing surfaced and accepted; #12 familiar with owning source outright and expects "an annual support subscription payment on top." Neither reacted to seat count.

**Buyers arrived with per-seat / subscription mental models unprompted:** #8 volunteered "_fifty users monthly subscription to be around two fifty euros_"; #12 benchmarked "_$90 per user per month_" (Claude Code Team); #8's whole frame was per-user/monthly SaaS.

**INFER.** ADR-0305's per-org/no-seat advantage-copy angle is **untested but well-positioned**: because real buyers default to per-seat framing, a no-seat perpetual model has a concrete, favorable contrast to land against ("_price the whole org once, not per developer_"). The evidence supports keeping the angle _and_ explicitly testing it — right now we have the contrast but zero measured reaction. Confidence low (pure inference, no direct probe). A recurring adjacent friction — billing-cadence confusion (#9 asked twice; #1/#3 needed one-time confirmed) — suggests the licensing _explanation_, not the model, is the current UX risk. (Recommendation R8.)

---

## Objections + risk themes

Ranked by cross-interview frequency and severity.

1. **Third-party proof / trust gap (highest-frequency, both instruments).** Survey MISSING question repeatedly named testimonials, case studies, reviews as the top pre-$1,000 unmet need — including the highest-quality response, a compliance-buyer asking for "_verifiable customer testimonials or case studies from established companies in healthcare or fintech._" Interviews: #2 wants code + testing docs over demos ("_if there's just a demo and nothing else and no code, then you might as well… flip on a YouTube commercial_"); #9 ranks working demo > docs > case studies for CTO buy-in; #8 wants a "_twenty to thirty second_" demo video. **This is the #1 conversion blocker and the design-partner program's reason to exist.**
2. **Named-standard coverage gap (severe, ICP-specific).** #7 dealbreaker on GDPR/PCI DSS not being visible; SOC2/HIPAA copy misses the regimes most named. High-severity because it's a hard stop for a warm buyer.
3. **Support / after-sales SLA clarity (recurring gating condition).** #4 accepts only once human support is added; #8 "_willing to give it a try on the condition that our after sales… is available_"; #12 expects an annual support sub. Packaging/messaging risk, not price.
4. **Price-too-low credibility (real, opposite-direction).** #12's "lowball" read against a tens-of-thousands/year GRC anchor. The risk to $1,049 is looking cheap for enterprise-grade, not looking expensive.
5. **Renewal 40% above maintenance norm.** #11's 15–20%-industry-standard pushback; negotiable, not a dealbreaker.
6. **Loss of control / build-vs-buy ROI gating.** #4 named loss-of-control as the single biggest adoption risk; #3/#5 gate entirely on documented ROI vs an in-house build; #6/#7/#10 resolved this favorably once the build-time reframe (2 months / 4–6 weeks) landed. The in-house-build reframe is a demonstrated lever — it flipped #1 from "a little high" to "reasonable."
7. **Integration/compatibility uncertainty.** #1 (encryption interop with current stack), #6 (data-migration integrity on switch) — mid-severity, resolvable with docs.
8. **Billing-cadence confusion.** #9 (twice), #1, #3 — a UX/explanation risk on the one-time + 12-month-window model.
9. **Persona/fit mismatch as implicit objection.** #5 (hardware, loose TS) — a recruitment lesson, not a product objection.

---

## Design-partner outreach hooks (which candidates/angles the evidence sharpens)

Program terms in play: ADR-0297 — 5 partners, 40% off, 12-month reverting, case-study **contingent on conversion**. The evidence sharpens both _who_ to recruit and _what to lead with_.

**Angles the evidence sharpens:**

- **Lead with the case-study exchange, targeted at regulated verticals.** The top unmet trust gap (survey MISSING + #2/#9) is exactly what the design-partner deal produces. The single highest-quality survey respondent asked for case studies "_from established companies in healthcare or fintech_" — so the highest-leverage partners are ones whose logo/story closes that gap. Frame outreach as "we want a reference design partner in [your regulated vertical] whose story we can show," not just a discount.
- **Recruit against the named-standard gap.** #7's PCI DSS/GDPR/ISO dealbreaker and the #6/#8/#11 regime spread mean partners in PCI/GDPR/ISO-27001 regimes double as proof _and_ as coverage-validation that fixes the copy gap. A partner who runs PCI DSS validates the crosswalk claims the site needs.
- **The "own your code / supply-chain" angle for security-forward shops.** #12's no-public-registries posture read owned-source as supply-chain mitigation, not compliance — a distinct hook for recruiting a security-conscious partner who values provenance over audit-prep.
- **The discount lands against an already-low-perceived price.** 40% off a number multiple buyers called "too good"/"no-brainer"/"extremely attractive" is a strong offer; the risk is _not_ that partners balk at price. Emphasize the reference/co-development value, since price is not the friction.

**Warmest candidate profiles (from the strong-buy cluster — treat as persona archetypes to source against, not as confirmed leads):**

- **EUDR/customer-facing-compliance SaaS (archetype: #6)** — "no-brainer" reaction, compliance is product-core, wants a readiness dashboard. Highest warmth.
- **Multi-standard European B2B with committee buying (archetype: #8)** — "extremely attractive," but gate is after-sales SLA; recruit with an explicit support commitment.
- **Field-encryption/tenant-isolation CX platform (archetype: #11)** — strongest compliance-wedge validation, named field-level encryption + HIPAA-prep as standouts; ideal for a compliance-vertical case study, and already flagged the 40% renewal, so terms should be pre-negotiated.

**INFER:** the design-partner program should over-index on regulated eng-leaders whose compliance is customer-facing (where strong buy signals concentrated), and its outreach copy should foreground the case-study/proof exchange, because proof — not price — is the demonstrated blocker.

---

## Recommendations for the operator fork board

Each is a proposal for the operator to lock or reject in `docs/state/decisions-and-forks.md`. None is auto-decided.

**R1 — HOLD the $1,049 Compliance anchor.**
Confidence: **HIGH.** Evidence: 9/10 interviewees who heard it reacted neutral-to-strongly-positive (3 unprompted "no-brainer/extremely attractive/sweet spot"); anchored ladder 56% general / 70% ICP acceptance; the only downside objection ran low (credibility), not high. No evidence supports a cut; the panel-noise "~$100" numbers are a mis-targeting artifact, not WTP. Consistent with ADR-0304 HOLD.

**R2 — HOLD $2,059 Everything but treat it as the least-validated anchor and measure it directly before launch.**
Confidence: **MEDIUM** (to hold) / **HIGH** (to measure). Evidence: zero interview probes; nearest survey rung $2,499 = 70% rejection (but $2,059 ≠ $2,499 and panel is off-ICP). Action: add $2,059 as a real rung in the re-run (R7) and probe it in design-partner conversations.

**R3 — Fix Frame A / compliance copy to name PCI DSS, GDPR, and ISO 27001 alongside SOC 2 / HIPAA (or make "your standard here" coverage explicit).**
Confidence: **HIGH.** Evidence: #7 explicit dealbreaker; #6/#8/#10/#11/#12 named GDPR/PCI/ISO, none led with HIPAA; #7 — named-standard recognition is what "_dragged your attention._" Low-cost copy change, direct conversion leak if unfixed. (Ties to the existing crosswalk work, ADR-0277/0279.)

**R4 — Keep the locked hero posture: platform-first for comprehension, compliance as the click-hook and flagship claim. Do not flip to pure-platform or pure-compliance.**
Confidence: **MEDIUM-HIGH.** Evidence: survey B-wins-on-clarity (45% vs 17%) reconciles with interview #6 ("B more compelling, but I'd click A first") and #11's A-choice; both map onto ADR-0040's existing "compliance wedge under a production-rigor umbrella." Refine B's plain-language clarity rather than re-pick the frame.

**R5 — Make third-party proof the top pre-launch conversion asset: case studies (regulated verticals), a working demo, and visible owned-source/code access.**
Confidence: **HIGH.** Evidence: survey MISSING top answer + #2 (code>demo), #9 (demo>docs>reviews), #8 (30s demo video). This is the #1 blocker across both instruments and the design-partner program's core deliverable (see hooks).

**R6 — Re-examine or justify the 40% update-window renewal against the 15–20% maintenance norm; consider a multi-year discount lever rather than a headline cut.**
Confidence: **MEDIUM.** Evidence: #11 reasoned pushback (40% vs 15–20% industry norm) + explicit multi-year-discount opening; counter-signal #1 accepted 40% without scrutiny and #12 expects an annual support sub. Not a dealbreaker; a soft edge worth a justification line or a 3-year lever.

**R7 — Re-run the pricing read against a screened ICP panel with front-loaded price context before any anchor move; include a direct $2,059 rung.**
Confidence: **HIGH.** Evidence: both surveys are panel-quality-compromised (66.7% / 59.3% "Other," samplicio.us referrals, nonsense free-text, extreme outliers); the open-ended VW collapsed to $10–$41 for lack of anchoring. Screen on role/ICP before entry, exclude panel-router traffic, and anchor the category before the VW battery. Until this exists, treat every quantitative number here as directional.

**R8 — Keep ADR-0305's per-org/no-seat as advantage copy AND add a direct test of it; separately, tighten the one-time + 12-month-window billing explanation.**
Confidence: **MEDIUM** (angle) / **LOW** (reaction, untested). Evidence: no interview tested per-org/no-seat, but #8/#12 arrived with per-seat/subscription frames the angle can contrast against; recurring billing-cadence confusion (#9 twice, #1, #3) is the current UX risk on the licensing model, not the model itself.

**R9 — Do NOT read the "cheaper than expected" cluster as a mandate to raise the price; log it as an open underpricing question for the screened re-run.**
Confidence: **LOW-MEDIUM.** Evidence: most reactions ran "cheaper than expected" and #12 read $1,049 as a credibility-damaging "lowball," which _could_ argue headroom — but the signal is confounded by small n, off-ICP panels, and value-not-yet-proven. The honest move is to measure headroom on a clean panel (R7), not to move on this evidence. Flag: a price that reads "too good to be true" is a real conversion risk for enterprise buyers, so any future raise is as much a credibility play as a margin play.

**R10 — Add explicit after-sales/support-SLA language to the offer.**
Confidence: **MEDIUM.** Evidence: #4 (support unlocks acceptance), #8 (SLA is the stated buy condition), #12 (expects annual support sub). A packaging/messaging fix that converts a recurring gating condition into a closed objection; also de-risks the R6 renewal framing by making the annual payment's value legible.

---

## Appendix: standout quotes

Verbatim, with persona context. Grouped by theme.

### $1,049 lands as cheap / strong buy

- **#6 — co-founder, EU EUDR-compliance SaaS (~2,000 customers), strong buy:** "_I would say a hundred thousand dollars maybe._" … "_Wow. And that's just… this amazing._" … "_It's just because it's gonna be easier, I think. it keeps a no brainer._"
- **#8 — product/CFO-committee, EU efficiency + music-royalty, strong buy:** "_Well, this is quite a quite a very good one to to buy for a onetime purchase. Extremely attractive._" … "_I mean, thousand dollars is is really quite… nothing in terms of value I'm expecting for it to create._"
- **#11 — eng/product, CX/social-listening SaaS, strong buy, strongest compliance-wedge validation:** "_That is interesting. I think it sits right in the sweet spot for midrange… It's a very realistic budget._"
- **#7 — tech director, UK ERP/web-services, moderate:** "_Immediate reaction is that is a very good price. Um, a lot lower than what I would think._"
- **#10 — head of architecture, car-rental SaaS (.NET-primary), moderate:** "_if it… has all those features, it's gonna… win much time to focus on other aspects of the ecosystem. So I value that._"

### The price-too-low / credibility objection

- **#12 — DX/tooling lead, ~30yr enterprise ITSM SaaS, weak buy:** "_It sounds possibly too good to be true. It sounds like a very very reasonable price… it does feel like a little bit of a lowball._" … "_compliance packages that I've seen, especially governance, risk, and compliance type packages were generally moved into the tens of thousands of pounds per year subscription… a thousand dollars… feels quite low._"

### The build-vs-buy reframe as a lever

- **#1 — dev/PM, localization SaaS, moderate (pre-guide-fix, low-effort respondent):** "_that's that's a little high… but, I mean, it it must it must be worth it, though._" … "_we would be very far behind and probably, uh, lose our funding._" … "_when we could just pay a thousand dollars and have it right there in house._"
- **#3 — dev, golf-tournament SaaS, moderate (never told real price):** "_I think it would significantly take more than five hundred or one thousand dollars_" [to build in-house]. … "_it's harder to implement something that other people have already solved._"

### Proof / trust over marketing (the #1 blocker)

- **#2 — founder, TrustChain (Solana security), moderate, self-described skeptic:** "_it's not, like, one thousand forty eight dollars and you get ninety eight percent of the product and then another five hundred dollars to get everything else working… then, uh, I would say that that's pretty fair._" … "_you can have AI create a very adulter[ated] demo… if there's just a demo and nothing else and no code, then you might as well, like, flip on a YouTube commercial._"
- **#9 — non-tech ops, AI recruitment platform, weak buy:** "_Definitely a working demo to begin with, that would be the most important._"

### Named-standard coverage gap

- **#7 — tech director, UK ERP/web-services:** "_I'd say that's why it stands out just because of how specific it is rather than… option b… quite sort of generic._" … "_The biggest deal breaker would be if it didn't cover, um, either of those [GDPR or PCI DSS]._"

### Positioning: platform-clarity vs compliance-hook

- **#8 — product/CFO-committee:** [Option B is] "_more exhaustive and authentic… you're already talking it as a production grade, and then you're also talking about the back end technologies… end to end business lines._"
- **#4 — non-dev analyst, tax/accounting SW, weak buy:** "_option a seems the most relevant. We need to be compliant._" … "_There is a lot of information already available in AI and things like that._" … "_I think human support behind it [is the missing piece]._"
- **#10 — head of architecture:** "_I mainly interested in the… features and the… implementation paths and all the technical assets that this platform can give me, and then I am interested about the compliance._" … "_we are not in under… in the mercy of any third party company._"
- **#12 — DX/tooling lead:** "_we're not pulling out modules, libraries from public package management repositories_" [own-source as supply-chain mitigation].

### Renewal / maintenance pricing

- **#11 — eng/product, CX/social-listening SaaS:** "_renewal number forty percent, four hundred twenty is a bit higher than the software industry average… standard software licensing and maintenance is usually fifteen to twenty percent… Forty is a bit aggressive._" … "_maybe if we were to sign for three years and if we could see if there were some discounts possible… I'd be down for it._"

### Support / SLA as buy condition

- **#8 — product/CFO-committee:** "_We would be at least willing to give it a try on the condition that our after sales from you, the company which is selling, is available to [help] us out if we are stuck somewhere._"

### Weak-fit / non-buyer texture (keep separate from ICP reads)

- **#5 — manager, laptop-hardware manufacturer, weak fit:** "_The frame be feels much clearer… it seems to be a little bit more the type of language we use within our Company._" … "_it couldn't be reasonable for me without looking at the actual bundle itself._" … "_TypeScript… will not fit. It's a little bit loose._"
- **#9 — non-tech ops:** "_I know we do have a budget of around twenty to thirty thousand… perhaps anywhere within the forty range._" … "_That's really good. Honestly, I don't deal with these sorts of things, so I can't sit here and say, that price is amazing._"

### Survey open-text (data-quality + signal)

- **Frame survey MISSING (highest-quality response, compliance-buyer persona):** asked for "_verifiable customer testimonials or case studies from established companies in healthcare or fintech_" as the one thing needed before a $1,000 purchase.
- **Frame survey, low-quality panel markers (why the price fields are unusable):** free-text answers included "_Sgrbsvr_," "_Ygghgh_," "_No se_," and profanity; one respondent entered 36,253,635 as a price expectation.

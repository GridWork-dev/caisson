# Evidence ledger — first-party research corpus (Phase-0, board audit)

**Compiled:** 2026-07-23 · **Compiler:** Phase-0 evidence collector D · **Snapshot read:**
`/home/gw/lab/caisson-audit-ro` (pinned, read-only) · **Company stage:** PRE-LAUNCH, pre-revenue.

**Method.** Every finding below is tagged `E-D<n>`, cites its source file(s) + date, states
sample size where one exists, and carries a validity tier:

- **STRONG** — real ICP behavior/interviews (a human buyer, in their own words, reacting to the
  actual product/price).
- **MODERATE** — surveys/quant with a stated n (even if off-target panel), or verified live
  competitive/cost data.
- **WEAK** — desk research, inference, synthetic-persona output, or unverified/stale claims.

No finding below is a decision. Decisions are ADRs (cited separately in §5) — this file is the
evidentiary record a board reviews to check whether decisions match what the evidence actually
says.

---

## 1. Cookiy real-ICP interview findings (positioning + WTP)

Two studies ran. **Study 1** (`019f4a11`, launched 2026-07-08, n=12 complete, real-ICP-adjacent
respondents) produced `outputs/research/wtp-synthesis-2026-07-10.md` (in-house synthesis) +
`outputs/research/cookiy-report-2026-07-10.md` (Cookiy's own platform-generated report over the
same transcripts). **Study 2** (`019f57b1`, launched 2026-07-12, target n=12, recruit exhausted
at n=5, OPERATOR-LOCKED FINAL at that n on 2026-07-16 per ADR-0352) produced
`outputs/research/cookiy-positioning-synthesis-2026-07-16.md`.

### E-D1 — Study 1 (n=12): the $1,049 Compliance anchor read as reasonable-to-cheap, not resisted

**Claim:** Of the ten Study-1 interviewees who heard the real $1,049 figure, nine reacted
neutral-to-strongly-positive (three unprompted "no-brainer / extremely attractive / sweet spot"
reactions); the one negative reaction ran in the *opposite* direction expected — a DX/tooling
lead read $1,049 as a "lowball" that undercut enterprise-grade credibility, not as too expensive.
**Source:** `outputs/research/wtp-synthesis-2026-07-10.md` §"Executive read" + §"WTP findings"
(interviews #1–#12, individually cited with interview IDs and verbatim quotes). **Date:**
fieldwork 2026-07-10; synthesis same date. **Sample:** n=12 total, n=10 heard the real number
(2 never saw it — #3, #5 reacted to self-generated anchors). **Tier: STRONG** for the 10 who
heard the number and reacted in their own words; the synthesis itself flags this cohort as
"real ICP-adjacent," not fully screened ICP (2 of 12 are explicitly off-fit: #5 hardware/loose-TS,
#4/#9 self-disclaimed non-buyers).

### E-D2 — Study 1 (n=12): the $2,059 Everything anchor has ZERO qualitative evidence

**Claim:** The $2,059 Everything bundle price was never shown or probed in a single one of the 12
Study-1 interviews. All commentary on it is extrapolated from the nearest quant-survey rung
($2,499, which drew 70% rejection). **Source:** `outputs/research/wtp-synthesis-2026-07-10.md`
§"Everything bundle — $2,059 (ADR-0304 HOLD)". **Date:** 2026-07-10. **Sample:** n=0 (real
interviews), n=27 off-ICP survey (nearest rung only). **Tier: WEAK** — this is a documented
*absence* of evidence, correctly labeled as such by the source; do not let any pricing narrative
imply $2,059 has been buyer-tested.

### E-D3 — Study 1 (n=12): positioning frame split — platform-first wins clarity, compliance-first wins the click

**Claim:** Survey 776545 (n=42, paired within-subject): Frame B (platform-first) beat Frame A
(compliance-first) 45.2% vs 16.7% forced-choice, driven by clarity (71.4% "clear" vs 47.7%), not
appeal (near-tied). Interview split was near-even (5 A / 6 B / 1 split-vote); the pivotal
data point (#6) rated Frame B _more compelling_ head-to-head but said they'd _click_ the
compliance-led Frame A first from a cold landing page. **Source:**
`outputs/research/wtp-synthesis-2026-07-10.md` §"Positioning frame results";
`outputs/research/wtp-synthesis-partial-2026-07-09.md` §3. **Date:** 2026-07-09/10. **Sample:**
survey n=42 (68% self-identified "Other" role — off-ICP); interviews n=12 (near-even split).
**Tier: MODERATE** (survey, off-ICP panel, but within-subject design is composition-robust) +
**STRONG** for the individual interview verbatims cited. **Reconciliation:** this pattern is read
by the synthesis as _validating_, not contradicting, the already-locked hero (ADR-0040:
compliance wedge under a production-rigor umbrella) — platform-first wins first-screen
comprehension, compliance-first wins the acquisition click.

### E-D4 — Study 1 (n=12): named-standard coverage gap — a stated dealbreaker

**Claim:** Frame A's copy names SOC 2 / HIPAA, but the regulated buyers in the sample repeatedly
named PCI DSS, GDPR, and ISO 27001 as their actual regime. One interviewee (#7, UK ERP/web
services) made this an explicit dealbreaker: _"The biggest deal breaker would be if it didn't
cover, um, either of those [GDPR or PCI DSS]."_ Five of the twelve interviewees (#6, #8, #10,
#11, #12) named GDPR/PCI/ISO regimes; none led with HIPAA. **Source:**
`outputs/research/wtp-synthesis-2026-07-10.md` §"Positioning frame results" (copy gap) + §
Recommendations R3. **Date:** 2026-07-10. **Sample:** n=12, 5/12 directly evidencing the gap.
**Tier: STRONG** (direct, named, verbatim dealbreaker from a real interviewee).

### E-D5 — Study 1 (n=12): third-party proof is the #1 conversion blocker

**Claim:** Across both the survey's open-text "what would you need before taking $1,000
seriously" question and the interviews, the dominant unmet need is third-party proof —
testimonials, case studies from regulated verticals, a working demo, and visible owned-source
code access — ranked as the single highest-frequency objection in the entire program. A
compliance-buyer survey respondent asked for "verifiable customer testimonials or case studies
from established companies in healthcare or fintech" before a $1,000 purchase. **Source:**
`outputs/research/wtp-synthesis-2026-07-10.md` §"Objections + risk themes" #1;
`outputs/research/wtp-synthesis-partial-2026-07-09.md` §5 convergence matrix row 1;
`outputs/research/cookiy-report-2026-07-10.md` Objective 5. **Date:** 2026-07-09/10.
**Tier: STRONG** (converges across survey open-text + interview verbatims + Cookiy's own
independent platform-generated report — three independent analytical passes over the same
transcripts agree).

### E-D6 — Study 1 (n=12): renewal ratio (40%/$419-$499yr) draws no pushback; the objection is 12-month-window ambiguity, not the number

**Claim:** Zero interviewees objected to the 40% renewal ratio itself; the one reasoned pushback
(#11: "forty is a bit aggressive" vs a 15–20% industry norm) still ended in openness to a
negotiated multi-year discount. The actual objection cluster (largest in the qual corpus, ~25/40
in the earlier synthetic-heavy round) is confusion about what happens after month 12, not the
price. Quant: 58% fair-or-would-pay on the updates model; ICP subset 7/9 fair-or-pay. **Source:**
`outputs/research/wtp-synthesis-2026-07-10.md` §"Subscriptions" + R6;
`outputs/research/wtp-synthesis-partial-2026-07-09.md` §4–5. **Date:** 2026-07-09/10.
**Tier: STRONG** (qual) + **MODERATE** (quant, off-ICP panel). This is flagged by the WTP memo as
the single strongest convergence (qual + quant agree independently) in the whole pricing
corpus.

### E-D7 — Study 2 (n=5 of 12, FINAL at this n): federal/public-sector segment has its own credibility grammar — SOC 2 and GDPR read as _overreach_

**Claim:** For a federal-buyer persona (#1, federal CMS), SOC 2 and GDPR read as wrong-audience
overreach ("reads as 'we're credible to enterprise SaaS buyers,' not 'we understand federal
compliance'"); the credible names for that buyer are FedRAMP / NIST 800-53 / FISMA — currently
**absent from Caisson's copy**. This respondent's stated #1 disqualifier: no proof the product is
actually vetted against the specific framework named, calling generic "compliance flagship"
language "marketing language until proven otherwise." **Source:**
`outputs/research/cookiy-positioning-synthesis-2026-07-16.md` §3, §5, §6, §10. **Date:**
fieldwork through 2026-07-15, synthesis 2026-07-16. **Sample:** n=1 clean data point (#1) within
a study of n=5 completes / effective usable-n ≈ 2–3. **Tier: STRONG** for the single interview
it rests on, but the source itself explicitly caveats this as thin (n=1) and names it "the
biggest new finding" of Study 2 while simultaneously warning "do not treat this as market
validation."

### E-D8 — Study 2 (n=5): screen-out reasons and data-quality collapse — effective usable-n is 2–3, not 5

**Claim:** Of 5 real-interview "completes," 2 are usable-quality ICP data (#1 federal, #5
health-admin), one is partially usable (#3, utilities-forker), and 2 are unusable: **#2 was
flagged by the Cookiy platform itself mid-interview for low-quality/off-topic answers** (the
respondent misread the product as an HR/employee-background-check tool); **#4 was a
self-described non-technical PM whose interview degraded into repeated audio breakdowns** and
never produced coherent product comprehension. Separately, **4 recruits were screened out before
reaching a complete interview** (screen-out ratio 4:5 against completes) — the corpus does not
record the specific screen-out reason codes for those 4, only the ratio and that the most recent
recruitment activity (2026-07-16) was itself a screen-out, i.e., ICP filtering is still actively
rejecting recruits. **Source:**
`outputs/research/cookiy-positioning-synthesis-2026-07-16.md` §"Study window" intro block, §9
"Recruitment status assessment." **Date:** 2026-07-16. **Sample:** n=5 completes / 4 screen-outs
/ effective usable n≈2–3. **Tier: WEAK-to-MODERATE** — this is itself a data-quality finding, not
a product finding; it bounds how much weight every other Study-2 claim can carry.
**Data gap, explicit:** the corpus never records _why_ the 4 screen-outs were rejected (role
mismatch vs. no purchase authority vs. technical unfit vs. other) — flag for the board as an
instrumentation gap, not a resolved fact.

### E-D9 — Study 2 (n=5): the study's own mandatory guide steps were skipped on most sessions

**Claim:** The mandatory verbatim $2,059 price-reaction probe was delivered as specified on only
2 of 5 interviews (#3, #4); the trust-signal ranking question ran cleanly on only 2 of 5 (#1,
#4). On the study's two highest-value questions, effective n≈2. **Source:**
`outputs/research/cookiy-positioning-synthesis-2026-07-16.md` §1 (Q5, Q6), §4, §9. **Date:**
2026-07-16. **Tier: WEAK** (moderator/guide-execution failure, explicitly disclosed by the
source as a material data-quality problem, not a hidden one).

### E-D10 — Study 2 (n=5): price reactions at the $2,059 tier split by anchor, one tier up from Study 1's pattern

**Claim:** One buyer (#1, federal, enterprise-anchored) called $2,059 "surprisingly cheap"; two
buyers (#3 ~$1,000 expectation, #4 ~$1,200 expectation) called it "a little expensive"/"a little
high," both anchoring below the real price; one (#5) gave no number but leaned "higher end...
reasonable investment." A new substitute surfaced: #3 explicitly considered "Codex/Claude on my
$100 plan" as a DIY alternative that makes $2,059 feel expensive. **Source:**
`outputs/research/cookiy-positioning-synthesis-2026-07-16.md` §4, §6, §7. **Date:** 2026-07-16.
**Sample:** n=4 of 5 gave any price reaction (n=2 gave the verbatim mandatory stimulus). **Tier:
STRONG** for what each individual said, but explicitly n≈2–4 and the source repeatedly warns
"do not treat this as market validation; treat it as directional message-refinement signal."

### E-D11 — Both studies converge: "ownership ≠ self-sufficiency" and "who supports me after I own the code" are unresolved buyer objections

**Claim:** Buyers who hear "you own the source" do not automatically read that as "you're
self-sufficient" — Study 2's #5 immediately asked what protections/support ship with the owned
code "so you don't need a third party"; Study 1 found the same pattern (buyers want explicit
scope on human-support-vs-patches-only after the 12-month window). **Source:**
`outputs/research/cookiy-positioning-synthesis-2026-07-16.md` §6, §8;
`outputs/research/wtp-synthesis-2026-07-10.md` §"Objections" #3, R10. **Date:** 2026-07-10/16.
**Tier: STRONG** (converges across both real-ICP studies independently).

### E-D12 — Both studies, explicit and repeated: synthetic-persona interviews are NEVER usable as market/WTP validation

**Claim:** Both Cookiy studies ran synthetic-persona interviews alongside real ones (Study 1's
earlier corpus was majority-synthetic per the deep-analysis critique; Study 2 ran 12 synthetic
sim-interviews reported separately). Every source that discusses them states explicitly they
carry no buying authority, show LLM-agreeableness bias, and must never be blended into WTP or
market-validation counts — usable only for copy-language refinement. **Source:**
`outputs/research/cookiy-positioning-synthesis-2026-07-16.md` §11;
`outputs/research/wtp-memo-2026-07-10.md` Evidence-base table (row 1). **Tier: N/A (a
methodology finding)** — flagged here because a board reviewing pricing claims must be able to
tell which underlying interview counts are real humans vs. synthetic personas; the corpus is
disciplined about this distinction throughout.

---

## 2. Willingness-to-pay / Van Westendorp quant surveys — explicit "do not lock pricing at this n" warnings

### E-D13 — Both quant surveys are off-ICP panels; the open-ended Van Westendorp numbers are explicitly unusable

**Claim:** Survey 776545 (positioning frame, n=42 total / n=37-42 across re-pulls) is 66.7%
self-identified role "Other"; only 33% (14/42) mapped to any Caisson persona. Survey 445432 (Van
Westendorp pricing, n=26-27 across re-pulls) is 61.5-59.3% "Other"; only 9-10/26-27 are
ICP-claimed, and of those, only 3 pass Van-Westendorp internal-consistency (monotonicity)
checks. The clean-ICP-subset open-ended VW medians (too-cheap $5, cheap $15, expensive $33,
too-expensive $45) are **consumer-app-shaped numbers, roughly 1/50th of the real $1,049 anchor**
— the source explicitly states: _"Reporting these figures to stakeholders as Caisson's
acceptable range would read as 'cut price 95%+,' which is a survey-mechanics artifact, not
willingness-to-pay,"_ and _"Do not compute or cite VW crossing points from this leg — at any fill
level."_ **Source:** `outputs/research/wtp-synthesis-2026-07-10.md` §"Van Westendorp read";
`outputs/research/wtp-synthesis-partial-2026-07-09.md` §4;
`outputs/research/wtp-memo-2026-07-10.md` Evidence-base table. **Date:** 2026-07-09/10.
**Sample:** n=26-27 (VW), 9-12 ICP/valid subsets, n=3 fully clean. **Tier: WEAK** (explicitly
disqualified by its own authors as decision-grade) — included here specifically so the board sees
the warning, not the number.

### E-D14 — The anchored price _ladder_ (same off-ICP panel, shown real dollar rungs) tells the opposite story from the open-ended VW question

**Claim:** When shown the actual rungs ($649/$1,049/$1,499/$2,499) rather than asked to generate a
number, the same panel rates $1,049 "fair or would consider" 55.6–58% of the time (69–70% at
$649, 44–46% at $1,499, 22–23% at $2,499). The divergence between the ~$20 open-ended guess and
the ~58% acceptance of $1,049 when shown is read by the source as evidence that _presentation and
anchoring dominate gut pricing_ — directional support for anchoring the price against a
build-cost comparator on-page, **not** a market-clearing-rate claim. **Source:**
`outputs/research/wtp-synthesis-2026-07-10.md` §"Van Westendorp read" table;
`outputs/research/wtp-synthesis-partial-2026-07-09.md` §4. **Date:** 2026-07-09/10. **Sample:**
n=26-27, ICP-fit n≈10 (70% acceptance at $1,049 for that cut). **Tier: MODERATE** (quant,
off-ICP, but internally consistent across two independent re-pulls of the same instrument).

### E-D15 — The corpus's own standing, most-repeated finding: no real ICP buyer has ever reacted to the actual $2,059 anchor, and the closer for the whole gap is named but not yet run

**Claim:** Repeated verbatim across at least four independent documents: _"No real ICP buyer has
ever reacted to any Caisson price"_ / _"the ≥5-interview real-ICP qual round whose guide reaches
the pricing screen"_ is named as the single standing instrument gap. Study 2 (n=5, final at this
n per ADR-0352) is the closest attempt made to date and still did not deliver a clean verbatim
$2,059 reaction (E-D9). **Source:** `outputs/research/wtp-memo-2026-07-10.md` TL;DR #1 and #6,
Data-gaps table; `outputs/research/wtp-synthesis-partial-2026-07-09.md` §2, §5;
`outputs/research/cookiy-positioning-synthesis-2026-07-16.md` §9. **Tier: N/A (negative-space
finding)** — this bounds every WTP claim in this ledger; the board should read every dollar
figure above through this lens.

---

## 3. Demand-signal / SEO research (desk research — WEAK tier by construction)

### E-D16 — Compliance-category keyword CPC is 10–50× every other Caisson-relevant cluster, at low competition

**Claim:** DataForSEO probe (cost $0.26) of US Google-Ads volume/CPC/KD shows compliance/legal/
fin-ops terms clustering at $70–261 CPC (e.g., "legal billing software" $261 CPC/1,300 vol/KD 41;
"compliance automation software" $212 CPC/480 vol/KD 10; "hipaa compliant software" $70 CPC/4,400
vol/KD 16) vs. $4–26 CPC for local-first-AI/AI-agent/boilerplate terms. The compliance SERP is
owned by finished platforms (Vanta, Drata, Sprinto, MetricStream, Cynomi) — no developer
starter-kit competes there today. **Source:** `outputs/research/demand-signals.md`. **Date:** not
separately dated in-file (Phase 2 of the original research program, referenced as pre-2026-07-09
baseline). **Tier: WEAK** — this is a keyword-market proxy for buyer budget, not a measurement of
any actual buyer's behavior; it is the strongest single piece of evidence for _why_ compliance is
the hero wedge but proves nothing about Caisson's specific conversion.

### E-D17 — Perplexity-commissioned external strategy report recommends a materially HIGHER price band than the one actually locked

**Claim:** An external report (Perplexity Computer, dated 2026-06-27, imported 2026-06-29)
recommends a Compliance perpetual price of **$2,999–$4,999** + $1,499–$1,999/yr updates — roughly
3–5× the $1,049/$2,059 anchors Caisson actually locked (ADR-0304, 2026-07-10). The same report
sizes the bundled 3-year obtainable market at $10M–$30M off a $1.5K–$5K blended ACV assumption,
and rates its own pricing table as "estimate," not fact. **Source:**
`outputs/research/market-competitive-analysis.md` (Primary verdict, Pricing & monetization
table, TAM/SAM/SOM table). **Date:** report 2026-06-27, imported 2026-06-29. **Tier: WEAK**
(external desk-research report, self-labeled with fact/estimate/assumption tiers; TAM figures
explicitly flagged as "direction, not investor-grade precision"). **Board note:** this is a
material divergence the board should see plainly — the actual locked anchor sits well below what
this externally-commissioned strategic report recommended, and the operator ADR (ADR-0304) does
not cite this report as a reason for holding lower; it cites the Cookiy qual/quant legs instead
(§2 above).

### E-D18 — Live competitor: AuditKit.dev is a real, paying, named subscription competitor on the compliance wedge

**Claim:** AuditKit.dev (crawled live 2026-07-09 and again 2026-07-10) ships near-identical
technical primitives to Caisson's `@caisson/audit-worm` (SHA-256 hash-chained, Merkle-proof
tamper-evident audit logs, SOC2 evidence packs, 51 controls, 15 policy templates) at
**$99–999/mo pure subscription**, tagline "80% Cheaper vs Vanta/Drata." It does not compete on
code ownership but establishes a real, lower-commitment subscription floor a price-sensitive
buyer could choose instead of a one-time $1,049+ spend. **Source:**
`outputs/research/market-intel-2026-07-09.md` Ranked finding #2;
`outputs/research/wtp-memo-2026-07-10.md` F1 evidence; `outputs/research/auditkit-parity-2026-07-10.md`.
**Date:** crawled 2026-07-09/10. **Tier: MODERATE** (live, verified, primary-sourced competitive
pricing data — the strongest-tier finding in this section because it is a direct observation of
a real market price, not inference).

### E-D19 — The Delve SOC2-fabrication scandal is real, corroborated, and directly usable in copy

**Claim:** YC-backed compliance-automation competitor Delve ($32M raised) was accused (corroborated
by TechCrunch 2026-03-22, Economic Times, and Delve's own partial response) of AI-fabricating 494
SOC2 reports for 400+ customers, with at least one named customer (Lovable) publicly confirming
exposure; still cited as the industry's cautionary tale as of a 2026-06-28 roundup. **Source:**
`outputs/research/market-intel-2026-07-09.md` Ranked finding #1. **Date:** original scandal
2026-03; still-cited reference 2026-06-28; compiled into this research 2026-07-09. **Tier:
MODERATE** (multi-source-corroborated news event, not Caisson's own research, but independently
verifiable and directly relevant to the "own vs. trust-our-AI" positioning claim).

### E-D20 — Comparables ceiling: no competitor at any price ships Caisson's specific WORM/field-crypto/OSCAL feature set

**Claim:** The nearest boilerplate-category price ceiling ($1,276–1,499: Gravity Elite, Supastarter
Agency) carries commodity feature sets; zero found comparables ship WORM audit logs +
field-level encryption + OSCAL evidence export at any price point. Separately flagged: the
market's $599–799 band typically buys ≤5 seats (Makerkit Team, Supastarter Startup), while
Caisson's equivalent-tier bundles ($629/$739) are unlimited-seat per-org licenses — later
resolved (ADR-0305, §5 below) as a mischaracterization: Caisson's license was already per-org
unlimited, not single-seat as this comparable framing implied. **Source:**
`outputs/research/prelaunch-fanout-2026-07/SYNTHESIS.md` §2;
`outputs/research/wtp-memo-2026-07-10.md` F1, F2. **Date:** 2026-07-07/10. **Tier: WEAK**
(comparables/desk research — the SYNTHESIS.md itself flags the specific comparable figures as
"not independently re-verified this dispatch" at one point in the chain).

---

## 4. Provider-cost rollup (verified 2026-07-12)

### E-D21 — Fixed monthly run-rate ≈ $45–65/mo (excl. AI-inference metering), verified live against vendor pages + live account probes

**Claim:** Live-probed provider status + vendor-page-reverified pricing (10-agent workflow,
session 2026-07-12) totals: Railway ~$20–40/mo (5 prod services + managed Postgres), Plausible
$9/mo, Linear Business $16/mo/seat — fixed floor **~$45–65/mo**, plus Blacksmith CI-runner usage
pending a free-tier-overage fork (est. $0–10/mo). Named cost-saving actions surfaced same
session: cancel the z.ai/GLM subscription (~$18/mo, only 3 smoke-test runs ever, 10 days dark —
~$216/yr saved), deprovision Cookiy's separate PAYG account line item hygiene, move Refero to
yearly billing (−$24/yr). Net non-AI-inference stack after those cuts: **~$80–130/mo** per the
2026-07-13 adversarial audit's independent tally (which folds in the same provider table plus
Exa, Refero, Recraft, PostHog, Vercel, Cloudflare/Tailscale/GitHub, Proton, and domains — several
of which are `watch`/`confirm` status, not yet nailed-down bills). **Source:**
`outputs/research/provider-cost-rollup-2026-07-12.md` (full status+cost table, "Fixed run-rate"
line); `outputs/audit/AUDIT-SYNTHESIS-2026-07-13.md` §C "Paid-provider audit" table + "Immediate
money moves" + "Net stack" line. **Date:** live-probed 2026-07-12; audited/cross-checked
2026-07-13. **Tier: MODERATE-to-STRONG** — this is live-probed account data (API/CLI probes
against Railway, Better Stack, Discord, Grafana, PostHog, Resend, GitHub), not an estimate, for
the rows marked "probed"; a few rows (Proton tier, domain registrar costs) are explicitly flagged
`confirm` — no invoice artifact found anywhere in the repo for those two lines.

### E-D22 — Site traffic/analytics is near-zero because the site is still access-gated pre-launch — not a conversion failure, a pre-launch state

**Claim:** PostHog (product analytics on caisson-prod) shows **12 events / 3 persons in the
trailing 30 days** as of the 2026-07-12 probe, explicitly annotated in-source: "site is
CF-Access-gated; volume arrives at go-live." This is not a demand signal — it is the expected
reading of an intentionally gated pre-launch property. **Source:**
`outputs/research/provider-cost-rollup-2026-07-12.md` PostHog row. **Date:** 2026-07-12. **Tier:
STRONG** (live-probed, first-party account data) as a _null-result_ finding — see the Demand
Ledger companion document for the full field-traction accounting this implies.

---

## 5. Standing ADR locks the board must not silently contradict

Every row below is a currently-standing, append-only operator decision. A board discussing
pricing, positioning, or GTM should check any proposed change against this list before assuming
it is unlocked ground.

| ADR                                            | One-line position                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ADR-0040** — Positioning-hero                | Two-layer positioning: Compliance is the hero/front-door wedge; "production-rigor" umbrella houses all editions behind it. Compliance leads on evidence (CPC, comparables, Cookiy), not preference. Launch sequences Wave 0 (free local-first) → Wave 1 (Compliance paid hero) → Wave 2 (AI-Production/Agentic-Dev), gated at a P2-exit go/no-go.                                                                      |
| **ADR-0297** — Design-partner first-N terms    | First 5 design partners, 40% off initial purchase, 12-month-reverting discount on any renewal, case-study rights contingent on conversion (churned partners owe nothing).                                                                                                                                                                                                                                              |
| **ADR-0304** — D3 anchor hold                  | Compliance HELD at $1,049, Everything HELD at $2,059. Explicitly a "don't touch it on this evidence" lock, not a "proven number" lock — no real ICP buyer has yet reacted to either anchor at the time of this ADR. Named reopeners: real-ICP anchor reactions (Cookiy study or design-partner conversations), a live checkout funnel naming price as drop-off, or a code-ownership competitor undercutting at parity. |
| **ADR-0305** — D2 per-org license posture      | Licensing is per-organization, unlimited authorized personnel — there is no seat concept at all (the EULA already grants this). The "single-seat mismatch vs. market comparables" framing in earlier research (SYNTHESIS.md §2, WTP memo F2) is corrected: it described the pricing page's silence, not an actual license term. Decision: surface as advantage copy, not a packaging change.                           |
| **ADR-0328** — Three-session close-out program | Locked the $130 Cookiy research budget as "general positioning research, not a pricing-only study" with one $2,059-Everything reaction probe folded in (this is Study 2, which as E-D9 shows did not deliver a clean verbatim reaction on that probe).                                                                                                                                                                 |
| **ADR-0352** (referenced in Study 2 synthesis) | Operator-locked STOP on Study 2's recruitment at n=5/12 — the recruit batch exhausted and no further spend goes to this study; this interim synthesis is the study's FINAL read, not a mid-study snapshot awaiting more data.                                                                                                                                                                                          |
| **ADR-0085** — Waitlist capture seam           | The site's primary pre-launch CTA is a waitlist (Cloudflare Pages Function → Resend Segments), explicitly built as an **inert seam** — "inert until a real Resend account + RESEND_API_KEY/RESEND_SEGMENT_ID env are wired ... no live launch" at the time of that ADR (2026-06-27). See Demand Ledger for current wiring status.                                                                                      |
| **ADR-0080** — Copy-messaging / copy law       | Binding compliance-copy rule cited repeatedly across GTM docs: Caisson ships audit/encryption/evidence _plumbing_ — copy must never claim the buyer becomes "HIPAA/SOC2 compliant" as a product guarantee.                                                                                                                                                                                                             |

---

## 6. What the 2026-07-13 adversarial audit already found and fixed (so the board doesn't re-litigate it)

The `AUDIT-SYNTHESIS-2026-07-13.md` (18-agent internal red-team workflow + independent Codex
cross-vendor review, 1.75M tokens) ran an adversarial pass over four in-flight product SPECs and
an infra/ops kickoff, and over the paid-provider stack (§4 above). Net verdict: **"nothing ships
to PLAN as-written"** — the product ideas survived, but several locked v1 scopes and factual
premises did not. Highlights most relevant to a business/evidence audit (full engineering detail
stays in that file, not restated here):

- **The corpus's own facts get re-verified and sometimes overturned in-place.** Example: a
  claimed MCP-protocol "deadline" premise was found dead on live verification against the actual
  current spec; a claimed "broken backups" state was found to already be running green
  (restic timer, real dated snapshots) — the audit corrected both rather than let stale claims
  propagate. This is presented as evidence the corpus practices real fact-checking discipline,
  not evidence that every remaining claim is now clean.
- **Four product SPECs (agent-ready DS surface, per-row verification UI, external/Rekor
  anchoring, compliance crosswalk) had locked v1 scopes contested and re-cut smaller** — in each
  case because the original lock either forced an unplanned new security-relevant surface (an
  unauthenticated public MCP server), over-built relative to evidenced demand (a dual-catalog
  OSCAL spine for zero-demonstrated FedRAMP need), or under-estimated true engineering cost by
  roughly 2–3×. All four were re-locked to smaller v1 scopes with the larger versions explicitly
  deferred, not silently dropped.
- **The paid-provider stack audit (§4 above, E-D21/E-D22)** is this same session's work — the
  cost-rollup numbers cited in this ledger were captured, then independently re-verified, one day
  later, by this adversarial pass.

---

## Cross-cutting caveats for the board

1. **Every dollar-figure WTP claim in this file rests on either an off-ICP survey panel or a
   single-digit real-interview count.** No claim above should be read as "market-validated
   pricing" — the corpus itself is unusually disciplined about saying so, repeatedly and in
   writing, and this ledger preserves that discipline rather than smoothing it over.
2. **The most recent real-ICP pricing study (Study 2) is CLOSED at n=5, not paused pending more
   data** (ADR-0352) — a board asking "when do we get more signal" should know the currently
   funded instrument has already run to its operator-locked stop point; the next closer named by
   the corpus is a fresh, properly-screened ICP round, not a continuation of Study 2.
3. **The externally-commissioned strategy report (E-D17) recommends a price 3–5× higher than
   what is actually locked.** This is flagged, not resolved, in the corpus — the operator's
   pricing ADR does not engage with or rebut that report's number directly.

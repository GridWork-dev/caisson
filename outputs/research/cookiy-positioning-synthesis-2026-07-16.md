# Cookiy positioning/messaging study — synthesis 2026-07-16 (FINAL at n=5)

- **Study:** `019f57b1-5535-717c-b0cc-d8fa6cf3402b` "Caisson pre-launch positioning and
  messaging validation" (launched 2026-07-12, Kickoff-Q).
- **Provenance:** ultracode fan-out (workflow `wf_06015678-9fa`): 5 sonnet transcript-extract
  agents (one per real completed interview) + a sim-signal check (3 of 12 synthetic runs
  sampled) + a prior-round grounding agent → one opus synthesis. Raw extracts live in the
  workflow journal; this document is the durable read.
- **Status:** OPERATOR LOCKED 2026-07-16 (picker): **stop at n=5** — the recruit batch
  exhausted at 5/12 and no further recruit spend goes to this study, so this interim
  synthesis is the study's FINAL read. Every recommendation below remains
  **recommendation-not-lock** on the fork board per the one-operator rule (ADR-0352
  records the stop decision).
- **Prior round:** study `019f4a11` (n=12, 2026-07-10) — `outputs/research/wtp-synthesis-2026-07-10.md`,
  `cookiy-report-2026-07-10.md`; §7 below maps confirmed / new / contradicted against it.

---

_(assumes today = 2026-07-16; interim read; small n stated throughout)_

# Caisson Positioning/Messaging Validation — Cookiy Study (INTERIM, n=5 of 12)

**Study window:** completes through 2026-07-15; latest activity 2026-07-16 (a screen-out). **Real completed interviews: 5. Screen-outs: 4. Recruitment target: n=12.**

> **Read this as INTERIM and thin.** Of the 5 completes, only ~2–3 are high-quality ICP data points (federal-CMS #1, health-admin #5, and partially utilities-forker #3). One respondent (#2) was flagged by the Cookiy platform itself mid-interview for low-quality/off-topic answers; one (#4) was a self-described non-technical PM whose interview degraded into repeated audio breakdowns. On top of that, the **moderator skipped or mis-executed the two most decision-relevant guide steps** — the trust-signal ranking (step 6) and the mandatory verbatim price probe (step 7) — on multiple sessions. Net usable coverage of the 7-question guide is far below n=5. **Do not treat this as market validation; treat it as directional message-refinement signal to be confirmed at fuller n.**
>
> The 12 synthetic sim-interviews are reported ONLY under §11 and are **never blended** into these counts.

---

## 1. Answers to the 5 core research questions (with evidence counts + verbatim)

### Q1 — Does the verbatim one-liner land unprompted? (Obj: comprehension)

**Clean, accurate comprehension: 2/5** (#1, #5). **Directionally-right-but-garbled: 1/5** (#3). **Failed: 2/5** (#2 quality-flagged, #4 audio-broken).

- **#1 (federal CMS) — clean:** _"you're selling the infrastructure behind compliance… not really like a dashboard you log into, but actual TypeScript source code you own outright… don't rent your compliance plumbing whenever because pricing or shut off access, own the code."_
- **#5 (health-admin) — clean:** _"it's going to be a source code, not a standalone subscription as well as it's something you own, not something you're renting."_
- **#3 (utilities-forker) — garbled but directionally right:** _"it already has all these sort of compliances inside it. I'm gonna have to worry about other extra security"_ — says the opposite of what he means (he means he _won't_ have to worry).
- **#2 — failed:** read it as an HR/employee-background-check tool: _"it is something that is going to give them more information about the employees."_
- **#4 — failed (audio):** after 4 repeats only _"It would be a standalone product… for businesses"_ — never described what Caisson does.

**Takeaway:** where the audio and respondent quality held, the "own the source, not a SaaS subscription" spine landed cleanly and was the single most-repeated-back idea. The phrase "compliance plumbing" reads as generic — see Q5.

### Q2 — A/B frame preference (compliance-first vs platform-first)

**A (compliance-first) = 2** (#1, #3) · **B (platform-first) = 1** (#4) · **Tie = 2** (#2, #5). See §2 for the word-level analysis.

### Q3 — Which framework names add credibility vs overreach?

Framework credibility is **audience-dependent** — the same acronym is a credibility hook to one buyer and overreach to another (full tally §later this section).

- **HIPAA:** wanted/credible by 4/5 (#1, #2, #3, #5); the single most-cited must-have.
- **SOC 2:** credible to the SOC-2-driven startup (#4, #5) but flagged **overreach for a federal buyer** by #1 (_"reads as 'we're credible to enterprise SaaS buyers,' not 'we understand federal compliance'"_).
- **FedRAMP / NIST 800-53 / FISMA:** named by #1 as the _actually credible_ federal control frameworks (the ATO frameworks) — **not currently in Caisson's copy.**
- **EU AI Act:** _"definitely the top one"_ for the health-AI buyer #5, but _"a little overreaching"_ for the SOC-2 startup #4.
- **GDPR:** credible/"in the news" to #3; **overreach/irrelevant** for federal #1 (_"unless CMS is handling EU citizens' data"_).

### Q4 — Open-base + paid-bundles model comprehension + bundle fit

**Clean grasp: 1/5** (#1) · **inferred/roughly-aligned: 1/5** (#5) · **hedged: 1/5** (#3) · **not grasped: 2/5** (#2, #4).

- **#1 (clean):** _"the core base is the Apache 2.0 license, fully open source… I can read the actual code, run it, and audit before spending anything… no black box."_ Wants to **buy narrowly** — only the compliance/audit-log module, _"not billing or tenancy."_ One-time per-org license framed as a **federal-budget-cycle plus**.
- **Bundle gravity = Compliance.** Named/chosen by #1 (audit-log slice), #2 (by name only), #3, #5 (Compliance + AI-Production). **#4 mismatch:** stated SOC-2 pain but picked **Local-first** — a stated-need-vs-choice contradiction, low confidence given the audio issues.
- **Narrow-buy desire (#1) validates the composable model** — "don't force me into modules I don't need" is a purchase precondition, not just a nicety.

### Q5 — Trust-signal ranking + instant disqualifiers

**Only 2/5 had the ranking question cleanly asked** (#1 read-the-code, #4 live-demo); #3 was cut short (proximate signal: case studies/real-world outcomes); **#2 and #5 never reached step 6.** Detail + disqualifiers in §3.

### Q6 (mandatory) — Verbatim price reaction to "$2,059 Everything one-time"

**The mandatory probe was executed as specified on only 2/5** (#3, #4). #1 reacted to the number but the question was posed obliquely; #5 never had the real number read (moderator substituted a generic "what would you expect" question); #2 never reached it. Detail in §4.

---

## 2. Frame A vs B tally + which words did the work

| Frame                                                                                          | Count | Who                  |
| ---------------------------------------------------------------------------------------------- | ----- | -------------------- |
| **A — compliance-first** ("Ship HIPAA/SOC 2-ready… in weeks")                                  | **2** | #1, #3               |
| **B — platform-first** ("auth, tenancy, billing, jobs, AI infra as composable source bundles") | **1** | #4                   |
| **Tie**                                                                                        | **2** | #2 (low-quality), #5 |

Dropping the platform-flagged #2: **A=2, B=1, tie=1.**

**The words that did the work:**

- **A won on the named framework acronyms.** #1: _"Ship HIPAA SOC 2 ready in weeks speaks directly to a compliance deadline pain point, and audit trails, encryption, evidence export maps onto exact stuff CMS cares about."_ #3: naming specific frameworks _"sparks their attention"_ — _"anybody looking for that's been noticed that already."_ The acronyms are the credibility hook; "in weeks" ties to a deadline.
- **Note the self-correction pattern (#1):** initially _drifted_ toward B's specificity (_"composable source bundles" felt specific/in-depth_) then self-corrected to A because the acronyms mapped to a live deadline. The specificity of B's module list is attractive; the deadline-relevance of A's acronyms is decisive.
- **B won (#4) only as an avoidance move**, not a positive: chose B _"the fact that it doesn't involve HIPAA"_ — HIPAA framing was actively unwanted for a SOC-2-only startup. That's a signal that **A's fixed HIPAA/SOC 2 pairing can repel non-HIPAA buyers**, not that B's breadth is compelling.
- **Ties (#5) saw no real differentiation:** _"they both offer security as well as compliance… I don't really see too much of a difference between the two."_

**Interpretation (small n):** among respondents who chose, compliance-first (A) drew more — but its power comes from _matching the buyer's specific framework_. A generic HIPAA/SOC 2 pairing helps HIPAA/SOC-2 buyers and mildly repels others. This **sharpens** (does not overturn) the prior round's "buyers split by pain point" finding.

---

## 3. Trust-signal ranking tally + disqualifiers

**The ranking question was properly run on only 2 of 5 interviews** — treat this as almost no data.

| Trust #1                                                           | Who                   | Reason                                                                                                                                                                                                                        |
| ------------------------------------------------------------------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Read the open-source code myself**                               | #1                    | _"a third-party audit letter or case studies ask you to trust someone else's verification, and a live demo only shows the happy path… for a federal CMS context you need to justify this as a security review / ATO anyway."_ |
| **Live demo**                                                      | #4 (non-technical PM) | stated plainly; no reason elicited (moderator moved on).                                                                                                                                                                      |
| _(proximate)_ case studies / proven real-world compliance outcomes | #3                    | _"people who don't get cases because they use this from the GDPR… proven to keep their companies out of that side of line"_ — a track record beats a spec sheet.                                                              |
| **not-asked**                                                      | #2, #5                | step 6 never reached.                                                                                                                                                                                                         |

**Pattern (thin):** the technical/regulated buyers (#1) want **code they can self-audit** — it maps directly onto their existing ATO/security-review process; the **non-technical buyer (#4) wants a live demo** because reading code isn't a tool she has. This is consistent with the prior round's "distrust polished demos, want hands-on testability," with a **new nuance: audience determines the trust artifact** (code for engineers, demo for non-technical champions).

**Disqualifiers / #1 blockers-to-buy:**

- **#1 (the sharpest signal in the study):** _"whether the compliance claims have actually been vetted against the specific framework CMS needs — HIPAA, FedRAMP, NIST 800-53, FISMA — or whether 'compliance flagship' is just marketing language until proven otherwise."_ **Framework-certification proof is the #1 disqualifier.**
- **#4:** not technical enough to self-vet — defers the go/no-go: _"I'm not in the weeds on that part. I'm just a project manager."_
- **#5:** wants to know _"what sort of protections are gonna come with it so you don't need a third party"_ — ownership alone didn't read as self-sufficient.

---

## 4. Price-reaction spread vs the $2,059 anchor + expected-price range

**Verbatim $2,059 stimulus delivered as specified: only #3 and #4.** This is a material guide-execution gap on the study's one MANDATORY question.

| #                       | Anchor context                                                                | Reaction to $2,059                                                                                                                             | Expected price                                                      |
| ----------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **#1** federal CMS      | enterprise/federal-GRC anchor (_"five or six figures annually per seat/org"_) | **"surprisingly cheap"** — _"a tiny number compared to typical federal compliance tooling"_ (question posed obliquely, not the clean verbatim) | no number; implied **far above** $2,059                             |
| **#3** utilities-forker | AI-coding-assistant anchor                                                    | **"a little expensive"** — reaches for DIY: _"can I get Codex to do it with my hundred dollar plan?"_                                          | **"tops a thousand"** (~$1,000, conditional on full detail)         |
| **#4** non-tech PM      | small-tool anchor                                                             | **"a little high"**                                                                                                                            | **~$1,200**                                                         |
| **#5** health-admin     | value/ROI anchor                                                              | **stimulus never read** — moderator substituted generic cost question                                                                          | no number; qualitative _"on the higher end… reasonable investment"_ |
| **#2**                  | —                                                                             | **not reached** (interview wrapped early)                                                                                                      | not-asked                                                           |

**Spread:** one buyer anchored **far above** the price and called it cheap (#1, enterprise/federal); two buyers anchored **below** it (#3 ~$1,000, #4 ~$1,200) and called it high/expensive; one (#5) leaned "higher end is appropriate" with no number. **Numeric expectations from the two who gave them: $1,000–$1,200, both below the $2,059 Everything anchor.**

This **confirms the prior round's anchor-dependence finding** ($1,049 was "a steal" to enterprise-anchored, "high" to small-utility-anchored) — the pattern reproduces one price tier up. **New at this price point:** the **DIY-via-AI-coding-assistant substitute** (#3) as the thing that makes $2,059 feel expensive.

---

## 5. Comprehension failures / confusing words in the one-liner

- **"compliance plumbing" / generic "compliance"** — the single recurring copy weakness. #1 explicitly would not trust the fit _until specific framework names (HIPAA/FedRAMP/NIST 800-53/FISMA) are called out_; generic "compliance" didn't land for a federal buyer.
- **"you own" ≠ self-sufficiency.** #5 heard "own the source" and immediately asked _"what sort of protections are gonna come with it so you don't need a third party"_ — ownership read as _more responsibility_, not less, absent a statement of what tooling/support ships with the source.
- **Pacing / length.** #4: _"You speak way too fast"_ — the one-liner delivered aloud in a 15-min video format overflowed a non-technical listener (partly a moderation/format issue, not pure copy).
- **Directional inversion (#3):** _"I'm gonna have to worry about other extra security"_ — comprehension right, self-restatement wrong; the value ("stop worrying about this") isn't sticky enough to be repeated back correctly.
- **Total misread (#2):** parsed as an HR/background-check "administrative" tool — but this respondent was platform-flagged, so low confidence.

**Framework credibility tally (credible ✓ / overreach ✗, by respondent):**

| Framework                     | Credible for                             | Overreach for                 |
| ----------------------------- | ---------------------------------------- | ----------------------------- |
| HIPAA                         | #1, #2, #3, #5                           | (unwanted by #4 — SOC-2-only) |
| SOC 2                         | #4, #5                                   | **#1 (federal)**              |
| FedRAMP / NIST 800-53 / FISMA | **#1 (federal — and MISSING from copy)** | —                             |
| EU AI Act                     | **#5 ("top one")**                       | **#4**                        |
| GDPR                          | #3                                       | **#1 (federal)**              |
| ISO 27001                     | #2 (uses daily)                          | —                             |

**Load-bearing insight:** there is **no globally safe framework list** — the credible set is buyer-segment-specific. A fixed HIPAA/SOC 2 headline helps its two segments and mildly repels federal (SOC 2 = overreach) and non-HIPAA (#4) buyers.

---

## 6. Top blockers (ranked by weight of signal)

1. **No proof the product is actually vetted/certified against the specific framework** (HIPAA/FedRAMP/NIST 800-53/FISMA) — #1's stated #1 disqualifier; "compliance flagship" reads as marketing until proven. _Highest-signal blocker in the study._
2. **DIY-via-AI-coding-assistant substitute** — #3 reaches for Codex/Claude ($100/mo) as the cheaper path to "the same outcome"; general build-in-house bias unless value is "undeniably clear."
3. **Price above expectation / no bundle price-point comparison** — #3 (~$1k), #4 (~$1.2k) both anchor below $2,059; #5 wants a bundle-by-bundle price comparison before committing to any number.
4. **"Ownership ≠ self-sufficiency"** — #5 needs to see what protections/support/tooling ship with the owned source before he'd drop third-party reliance.
5. **Non-technical buyer defers the go/no-go** — #4 explicitly can't self-vet fit; needs a technical champion to sign off (consistent with the prior round's two-tier approval).

---

## 7. Confirmed vs NEW vs CONTRADICTED (relative to the 2026-07-10 round, n=12)

**CONFIRMED**

- **Acronyms = instant credibility hooks.** Reproduced strongly (HIPAA/SOC 2/FedRAMP).
- **Price reaction is anchor-dependent.** Enterprise/federal-anchored (#1) → "surprisingly cheap"; small-tool/AI-anchored (#3, #4) → "a little high," expected ~$1,000–$1,200. Same split as the prior $1,049 finding, one tier up.
- **"Too cheap → is it really production-grade?" suspicion** — #1's "surprisingly cheap for a federal context" carries the same implicit doubt the prior round named.
- **Distrust of polished demos; want hands-on/self-audit proof** — #1 ranks reading-the-code #1 for exactly the prior round's reason (AI can fake visuals; happy-path demos prove nothing). Direct lineage to the ADR-0350 sandbox lock.
- **Two-tier approval** — #4 defers to technical sign-off (technical champion validates → budget holder decides).
- **Perpetual ownership as the de-risking claim** — #1 frames one-time-per-org as easier to justify than a subscription.

**NEW (not in the prior round)**

- **Federal / public-sector segment with its own framework grammar.** For a federal buyer, **SOC 2 and GDPR read as overreach/wrong-audience**, and **FedRAMP / NIST 800-53 / FISMA are the credible names — and they're absent from Caisson's copy.** This is the biggest new finding.
- **DIY-via-AI-coding-assistant as an explicit competitor** ("can I get Codex/Claude to do this on my $100 plan?") — a new substitute that reframes $2,059 as expensive.
- **"Ownership ≠ self-sufficiency" objection** — buyers ask what protections/support/tooling ship _with_ the owned source (#5); ownership can read as _more_ burden.
- **Framework credibility is audience-dependent** — EU AI Act was "top" for a health-AI buyer and "overreaching" for a SOC-2 startup in the same study. No universally safe framework list.
- **A's fixed HIPAA/SOC 2 headline can repel non-HIPAA buyers** (#4 chose B specifically to escape HIPAA framing).

**CONTRADICTED / SOFTENED**

- Prior round: _"platform-led (B) is slightly more compelling overall."_ This round leans the other way — **compliance-first (A) drew more among those who chose (A=2, B=1, tie=2).** **n is far too small to overturn the prior n=12**; log as _directional tension to resolve at fuller n_, not a contradiction.

---

## 8. Recommended messaging/copy adjustments

_(Every item below is a **recommendation, not a lock** — per the Caisson one-operator rule, these wait for the operator on `docs/state/decisions-and-forks.md`; none are pre-bound.)_

1. **recommendation, not a lock:** Make the framework list **audience-swappable rather than a fixed HIPAA/SOC 2 pair.** Consider segment-matched headline variants (federal/public-sector → FedRAMP/NIST 800-53/FISMA; commercial SaaS → SOC 2; EU/AI → GDPR/EU AI Act). Evidence: #1 (SOC 2/GDPR = overreach, wants federal names), #4 (chose B to escape HIPAA), #5 (EU AI Act "top").
2. **recommendation, not a lock:** **Add a "how compliance is proven" proof artifact** front-and-center — sample evidence pack, OSCAL export sample, and an explicit statement of what has/hasn't been third-party assessed. Evidence: #1's #1 disqualifier ("vetted against the specific framework, or just marketing?").
3. **recommendation, not a lock:** **State what ships _with_ the owned source** — support scope, patch cadence, tooling/editability — to kill the "ownership = more burden / still need a third party" read. Evidence: #5.
4. **recommendation, not a lock:** **Pre-empt the "just use Codex/Claude" objection** with a build-vs-buy framing (hours saved, correctness of money/crypto/audit seams, maintenance) at the pricing surface. Evidence: #3.
5. **recommendation, not a lock:** **Lead the price with a bundle-by-bundle comparison table**, not just the Everything anchor — two buyers wanted to see per-bundle price-points before judging value. Evidence: #3, #5.
6. **recommendation, not a lock:** **Tighten the one-liner's ownership benefit so it survives restatement** — "you _stop_ maintaining the compliance plumbing" (outcome) over "compliance plumbing… you own" (which #3 inverted). Keep "not a SaaS subscription" — that spine landed cleanly (#1, #5).
7. **recommendation, not a lock:** **Surface the narrow-buy / composable story earlier** — #1 wants only the audit-log module; "buy just what you need, audit the open base first" is a purchase precondition worth stating, not burying.

---

## 9. Recruitment status assessment (n=5/12)

**Signal is NOT saturating. Continue recruitment — and tighten screening + moderation.**

- **Effective usable-n is ~2–3, not 5.** #2 was platform-flagged for low-quality/off-topic answers (misread the product as an HR tool); #4 was a self-described non-technical PM whose session degraded into repeated audio breakdowns and never produced coherent comprehension. Only #1 (federal), #5 (health-admin), and partially #3 (utilities) are usable ICP data.
- **Guide execution was materially incomplete.** The **mandatory price probe** was delivered as specified on only 2/5 (#3, #4) — #1 got it obliquely, #5 got a substitute question, #2 never reached it. The **trust-signal ranking** ran on only 2/5. On the study's two highest-value questions we effectively have n≈2.
- **Screen-out ratio (4 screen-outs to 5 completes)** suggests ICP targeting is roughly working but slow; the newest activity (2026-07-16) is a screen-out, i.e. still filtering.
- **Recommendations (not locks):** (a) hard-screen for _technical ICP with purchase influence_ and _working audio/video_ before booking; (b) instruct the moderator to **always** deliver the verbatim $2,059 stimulus and the trust ranking — these were skipped too often to draw price conclusions; (c) deliberately recruit at least one more **regulated-commercial** (SOC 2 / PCI) and one more **EU/GDPR** buyer to test the audience-dependent-framework hypothesis; the accidental federal skew (#1) is a lead worth deepening but shouldn't dominate the read. **Do not close the study or ship pricing/positioning locks on this n.**

---

## 10. Open forks (operator-only decisions)

1. **Frame default at fuller n:** the prior n=12 favored platform-first (B); this interim n=5 leans compliance-first (A). Which is the default site headline, and is it **segment-swappable** vs. a single fixed frame? _Operator locks after n≥12._
2. **Whether to pursue the federal / public-sector segment as a named ICP** — it wants FedRAMP/NIST 800-53/FISMA language and reads SOC 2 as overreach; serving it may mean framework-specific proof work (actual assessments), a different copy track, and a procurement motion. **Enter or not?**
3. **How much framework-certification proof to commit to** — #1's #1 blocker is "actually vetted vs. the specific standard." Does Caisson pursue third-party assessment/attestation for any framework, or stay at "self-auditable open source + evidence tooling"? A cost/positioning fork only the operator can set.
4. **Pricing:** the two numeric expectations ($1,000, $1,200) sit below the $2,059 Everything anchor while the enterprise/federal anchor sits far above. Anchors in ADR-0012; display committed by ADR-0082 — **any number change remains operator-owned and un-pre-bound.** No recommendation to move price on this n.
5. **Build-vs-buy-vs-AI positioning** — whether to explicitly position against "just use Codex/Claude" is a strategic messaging choice with competitive framing implications.

---

## 11. Synthetic sim-interviews — reported separately, NOT blended

12 synthetic-persona runs exist. Per the sim-check verdict, they are **usable for message-refinement / persona-credibility / pain-language validation ONLY — never as market validation.** They carry no buying authority, show subtle guide-bias convergence on "read-the-code / avoid lock-in," accept budget frictionlessly, and resolve into perfect problem-product fit — three artifacts real buyers don't reproduce. **They are excluded from every count in §§1–10 above.** Their one corroborating note: they independently echo the "code inspectability = trust" theme that the real #1 ranked #1 — but that's persona convergence, not confirmation. Use for copy language; cite only the 5 real interviews (with the usable-n≈2–3 caveat) as ground truth.

# memo-product-site.md — Phase-3 domain synthesis: PRODUCT + SITE + UX (pre-launch readiness)

Domain: does the deployed site/product sell the story, and what must be true before traffic.
Seats synthesized: **T3** (Product-Craft Critic, primary), **S3** (Voice of Buyer, primary),
**S4** (Positioning Strategist, site-copy layer only — category/wedge strategy is out of this
domain's scope), **T2** cross-referenced as a binding precondition (its findings are
security-domain in origin but are, in substance, site-copy-truth defects: does the homepage's
own claim match the shipped code). Inputs: `EVIDENCE.md` gates (binding), all 8 Phase-1 memos,
`critique-claude.md`, `critique-codex.md`. No claim below originates outside those ten
documents; every correction is a critique-sourced tag fix or fact fix, not new evidence.
Snapshot cited throughout: caisson `main` @ `f6df03f9`, ADR-0378 site redesign shipped and
critiqued as final (E-I2 correction, binding).

---

## 1. Ranked findings — does the site sell the story?

Ranked by severity, each finding carries its **synthesis-corrected** evidence tag (not the
originating memo's tag, where a critique corrected it) and a disposition pointer into the
Dissent Ledger (§5).

**1. [PRD-1, PRD-2] The site's own trust claim is broken in two places at once, and both are now publicly reachable.**
T3's walkthrough (OBSERVED, independently re-verified by critique-claude this session) found the
hero and closing CTA both lead with `bunx @caisson-sh/cli@latest` — a package never published —
rendered beside a success-tone "ready" status chip; the site _certifies its own dead command_.
Checkout dead-ends behind a login gate and a sandbox-only Paddle overlay. Separately, T2's
security-domain read (tag corrected: **OBSERVED-by-one-seat**, not CORROBORATED — E-B2/E-B3 only
establish what the marketing copy says, the code-comparison half is T2's own file:line read,
verified verbatim by critique-claude) found the homepage claims S3 Object Lock COMPLIANCE-mode
resistant to a leaked root key, while the shipped default is GOVERNANCE and the sole live test
explicitly never exercises COMPLIANCE. Both defects are the same species of harm: a brand whose
spine is "claims are scraped and dated, never invented" (E-B3) is, as of this snapshot, publishing
a false and a dead claim simultaneously. **This is the single most important fact in the
product/site domain** — both critiques independently flag it as the collision the rest of the
board missed (see §3).

**2. [PRD-3] The price footnote implies buyer validation the corpus does not support at the live number.**
T3 point 2, tag **corrected to INFERRED** (critique-codex: the source proves a $1,049-vs-$1,449
gap, not that the footnote _causes_ a buyer to infer validation — that causal step is a craft
read, not an observation). The homepage sign-off ("buyers we interviewed put the in-house build
… against that build. $1,449, one-time") is attribution-clean under ADR-0080 but juxtaposes a
number no interviewed buyer ever heard. Stands as a real, if narrower, craft defect.

**3. [PRD-4] Message-match is genuinely good on two fronts and genuinely bad on none of the fronts S3 claimed.**
S3's "site leaves month-13/support-scope unresolved" is **STRUCK** — both critiques independently
verified the deployed source contradicts it: the homepage states "support is included: a real
person on email and Discord … with every license" (line ~258) and the plans-page FAQ answers
"What happens after 12 months?" directly (lines 63/205). The true residual, carried forward from
T3 instead, is narrower and correct: the answer exists but sits three clicks deep, and the
homepage footnote answers _perpetuity_ (the adjacent-but-different question) at the point of
decision. Synthesis carries T3's version; S3's does not survive.

**4. [PRD-5] The product is ahead of its own copy on the single named dealbreaker regime — cross-corroborated by two independent seats.**
T3 and S4 independently found the same gap by different methods (T3: walkthrough; S4: repo-code
cross-read) — genuine cross-corroboration, the strongest finding in this domain. The repo ships
ISO 27001 and NIST 800-53 crosswalks (`frameworks-pack/src/crosswalks/regimes.ts`,
`nist-800-53.ts`, both file-verified) that the hero-level crosswalk sentence never names, while
5/12 Study-1 buyers named GDPR/PCI/ISO as their actual regime and one made coverage an explicit
dealbreaker (E-D4). SOC 2/HIPAA leads the copy; the buyers who spoke named something else.

**5. [PRD-6] The comparison-surface gap is real but narrower than S4 stated.**
S4's "nothing for the DIY-agent alternative" is **PARTIALLY STRUCK** — critique-claude verified a
`build-in-house` compare slug already exists in the 21-page `/compare/*` table. The underlying
recommendation (name the DIY-with-agents comparison explicitly, since it's the one substitute a
real buyer actually named, E-D10) stands; the "nothing exists" framing does not. Sentrik and
Probo are genuinely absent from the comparison set — that part of S4's finding holds.

**6. [PRD-7] The price footnote's implied "buyers approve of a higher number" reading is a cherry-pick, not a fact — S3's contested framing is the correct one to carry.**
S4's "the only price-credibility signal on record points upward" is **FALSE by omission** in both
critiques: the same corpus (E-D10) records two below-anchor reactions ("a little expensive" at
$1,000–$1,200 expectation) that S4's own point 1 cites elsewhere and then drops here. The
domain's official position is S3's more honest framing: price direction is **CONTESTED by
sample**, not resolved upward — relevant because it directly qualifies how confidently the
footnote in Finding 2 can ever be defended, even after a copy fix.

**7. [PRD-8] Third-party proof is the real gap — but "none of it can exist yet" overstates the site's own trust strategy.**
S3's claim is **corrected, not struck**: E-B3 documents that the site already delivers one form of
proof — inspectable, dated, checkable code — which several buyers in the corpus do value (the
technical champion's half of the trust map). What genuinely cannot exist yet is the _economic
buyer's_ half: testimonials, case studies, a passed audit from a regulated vertical. The
`/partners` page is the one surface built to manufacture that artifact (T3, OBSERVED, verified) —
and its CTA is a bare `mailto:support@caisson.sh`, no form, no capture, no analytics event. Minor
scope correction (critique-codex): the ledger proves zero _sends_, not zero traffic _to the page_
— T3's stronger phrasing overstates what the ledger can show.

**8. [PRD-9] The homepage's clarity budget is inferred to be over-spent on catalog taxonomy — hold this at INFERRED, not buyer-corroborated.**
T3's four-competing-chooser-surfaces critique (two doors → "three shapes" → six bundle cards → a
SKU matrix → "pick a path") is a walkthrough judgment. Critique-codex flags that T3's own citation
for "the persona who bounces" leans on Study-2 respondent #4, whom the corpus itself marks
unusable (off-fit, audio breakdown) — that citation cannot support a buyer-confirmed confusion
claim. The structural observation (five decision surfaces on one scroll, the lede sentence
"Every price on this site now carries one of three labels" is governance language, not buyer
language) stands as **INFERRED walkthrough judgment only**.

---

## 2. Launch-readiness list — what must be true before traffic

In dependency order, not urgency order (per both critiques: this is the precondition layer inside
any contact-now motion the strategy track proposes, not a competing timeline):

1. **The first command must be true.** Either the `@caisson-sh/cli` npm package ships, or the
   hero/closing-section install line changes to an action that executes today. [PRD-1]
2. **The pay path must resolve or the site must stop pretending it's live.** Live Paddle behind
   "Pay now," _or_ restore the access gate so the gated-launch state is expressed by
   unreachability, never by a dead button on a public page. [PRD-1]
3. **The WORM/COMPLIANCE claim must be corrected under ADR-0080 without touching ADR-0040's
   hero.** Label GOVERNANCE as the proven default; COMPLIANCE as an unproven, explicit opt-in
   until a live irreversible-delete-denial proof exists. This is T2's launch-blocking finding,
   carried into this domain because it is a copy-truth defect, not merely a security posture
   question. [PRD-1]
4. **The price footnote's implied-validation reading must be defused** — either reframe the
   sentence so it no longer invites "buyers weighed _this_ number," or wait for a live-anchor
   reaction before keeping the juxtaposition as-is. [PRD-2, PRD-7]
5. **Three copy-level message-match fixes, none requiring new evidence:** name ISO 27001 (and
   ideally NIST 800-53, the federal-buyer signal is thin at n=1 but the ISO one is not) in the
   hero-level crosswalk sentence; surface the month-13 answer as one sentence + link next to the
   homepage perpetuity footnote instead of three clicks deep. [PRD-4, PRD-5]
6. **Instrument `/partners`.** Replace the bare mailto with a form or, at minimum, a tracked
   click — it is the only page built to manufacture the corpus's #1-named proof gap, and it is
   currently invisible to analytics. [PRD-8]
7. **Re-cut the homepage's middle, at INFERRED confidence** (does not block traffic, should not
   block it either): fold "Pick a path" and "three shapes" into one chooser surface; rewrite the
   labeling-system lede into buyer language. [PRD-9]

Items 1–3 are the hard floor — both critiques independently name them as the factual refutation of
the "all technical gates are green" premise the strategy track (S1/S2/S3's recommendations, outside
this domain) relies on to justify buyer contact now. Items 4–6 are days of copy work, need no new
research, and should ship in the same window. Item 7 is real but lower-stakes craft polish.

---

## 3. Agree/disagree map

**Agree (cross-corroborated, different methods):**

- T3 (walkthrough) + S4 (repo-code read) independently land on the same ISO 27001/regime-naming
  gap. [PRD-5] — the domain's single strongest finding.
- T3 + T2 independently converge on "the site currently overclaims" — different objects (a dead
  CTA vs a false compliance-mode claim), same defect class (artifacts not true-to-built). Neither
  seat cited the other; the synthesis joins them. [PRD-1]

**Disagree (synthesis must pick a side, not average):**

- S3 says month-13/support is "unresolved" on the site; T3 (and the deployed source, directly
  verified) says it is answered but buried. **T3 wins** — S3's version does not survive. [PRD-4]
- S4 says the only price-credibility signal "points upward"; S3 says price direction is contested
  by sample. **S3 wins** — S4's claim is a verified cherry-pick (omits the same corpus's
  below-anchor reactions). [PRD-7]
- S4 says the comparison set has "nothing for the DIY-agent alternative"; the repo already ships a
  `build-in-house` compare slug. **Neither wins cleanly** — the slug exists (S4's "nothing" is
  wrong) but Sentrik/Probo are genuinely missing (S4's underlying point is right). [PRD-6]

**Unresolved dependency, not a disagreement to average:** the strategy track (S1/S2/S3's
recommendations) treats immediate buyer/market contact as ready to execute; this domain's findings
(T2 launch-blocking + T3's dead CTAs) show the artifact those buyers would land on is not yet
true. Both critiques are explicit that this is a **precondition relationship, not a sequencing
debate** — Finding 1 / launch-readiness items 1–3 sit _inside_ any 30-day contact window other
seats propose, not before or after it as a separate track.

---

## 4. Minority Report (verbatim — do not launder)

Both critiques independently flagged specific verbatim claims at risk of being softened into
generic "polish items" or "validate demand" language during synthesis. Preserved here exactly:

> **T3 (critique-claude's DIS-T3, re-affirmed by critique-codex's "preserve the first-interaction
> truth test"):** "the first command every technical champion runs **fails**" —
> `bunx @caisson-sh/cli@latest`, never published, rendered beside a "ready" status chip.
> (`dual-door-hero.tsx:119-121`, verified this session; DEMAND-LEDGER §3.)

> **T2 (critique-claude's DIS-T2):** "the homepage presents S3 Object Lock in COMPLIANCE mode as
> the shipped posture and promises resistance even to a leaked root key, while `S3ArtifactStore`
> defaults to GOVERNANCE and the sole live proof explicitly never tests COMPLIANCE." (`page.tsx`
> EVIDENCE array + `store.s3.live.test.ts` header — both re-verified this session.)

> **critique-codex, direct instruction:** "Do not send a skeptical buyer to a public page whose
> first install command references an unpublished package and whose checkout is unavailable or
> sandbox-only. This is not copy polish. It is a falsifiable breach of the site's own
> artifact-truth positioning."

> **S3 (the site's price footnote, its most quotable line — kept for Finding 2's benefit of the
> doubt, even though the "none of us has ever seen the price" framing belongs primarily to the
> pricing domain, not this one):** "None of us has ever seen the price you are actually charging."

> **critique-claude, explicit warning against laundering (both apply directly to this domain):**
> "DIS-T2 and DIS-T3 will be summarized as 'polish items' — they are the factual refutation of
> 'gates GREEN' and must stay adjacent to any send-the-emails recommendation." … "S3's version
> must not survive into the synthesis" (re: month-13/support).

> **critique-codex, synthesis constraint applied in this memo:** "Scopes 'technical gates green' to
> the free-tier flip receipt and reconciles T2/T3 before any paid/public traffic recommendation."

---

## 5. Dissent Ledger

| id     | claim (source seat)                                                                                                                        | disposition                                                                                                                                                                                                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRD-1  | T3: dead install command (rendered "ready") + dead/sandbox checkout                                                                        | **ADOPTED**, elevated to launch-blocking precondition — independently verified by critique-claude this session                                                                                                                                                                    |
| PRD-2  | T2: homepage COMPLIANCE-mode/root-key claim false as shipped vs GOVERNANCE default                                                         | **ADOPTED** as launch-blocking precondition inside this domain (copy-truth, not just security posture); tag corrected OBSERVED-by-one-seat, not CORROBORATED, per both critiques                                                                                                  |
| PRD-3  | T3: price footnote implies buyer validation of $1,449                                                                                      | **ADOPTED**, tag corrected OBSERVED → INFERRED (critique-codex: the causal "implies" step is a craft read)                                                                                                                                                                        |
| PRD-4  | S3: month-13/support "unresolved" on the site                                                                                              | **STRUCK** — contradicted by direct source verification (homepage line ~258, plans FAQ 63/205) in both critiques; T3's "answered but three clicks deep, wrong-question-at-the-decision-point" carried forward instead                                                             |
| PRD-5  | T3 + S4: ISO 27001/NIST 800-53 shipped, absent from hero copy                                                                              | **ADOPTED**, strongest finding in the domain — genuine independent cross-corroboration by two different methods                                                                                                                                                                   |
| PRD-6  | S4: comparison set has "nothing for the DIY-agent alternative"                                                                             | **PARTIALLY STRUCK** — a `build-in-house` compare slug exists (verified); Sentrik/Probo absence stands, "nothing" flourish does not                                                                                                                                               |
| PRD-7  | S4: "the only price-credibility signal points upward"                                                                                      | **STRUCK** as a verified cherry-pick (omits E-D10's below-anchor reactions cited by S4's own point 1); S3's CONTESTED-by-sample framing **ADOPTED** as the domain's position                                                                                                      |
| PRD-8  | S3: third-party proof "none of it can exist yet"                                                                                           | **CORRECTED, not struck** — inspectable code (E-B3) is a delivered partial proof; testimonials/case studies from a regulated vertical remain the true, narrower gap; `/partners` mailto-only CTA finding (T3) stands with minor scope correction (zero sends ≠ zero page traffic) |
| PRD-9  | T3: homepage clarity budget over-spent on catalog taxonomy (4 chooser surfaces)                                                            | **ADOPTED at INFERRED confidence only** — critique-codex found T3's supporting citation leans on an explicitly-unusable Study-2 respondent; the structural observation stands, the buyer-confusion attribution does not                                                           |
| PRD-10 | Cross-track collision: "all technical gates are green" (used by S1/S2/S3 outside this domain) vs T2+T3's verified launch-blocking findings | **PRESERVED AS A DEPENDENCY, not sequencing** — both critiques instruct that this domain's readiness bar sits _inside_ any contact-now window, never softened to a parallel or later track                                                                                        |

---

## Bottom line

The site does two things well that the corpus asked for (ISO 27001/regime coverage exists in the
product, if not yet the hero copy; the month-13 answer exists, if not at the decision point) and
two things badly that are not craft nitpicks: it certifies a dead install command as "ready," and
it makes a compliance-mode claim the shipped code does not back. Both are present-tense, both are
now on a publicly reachable page, and both must clear before this domain can tell any other seat
the site is ready to receive the traffic they want to send it.

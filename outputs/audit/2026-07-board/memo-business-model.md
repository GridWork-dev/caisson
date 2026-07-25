# Business Model, Pricing & Pivot/Persevere — Phase-3 Synthesis

Compiled from: EVIDENCE.md + all indexed section files, DEMAND-LEDGER.md, OPERATOR-CONSTRAINTS.md,
all 8 memos (`s1`–`s4`, `t1`–`t4`), both critiques (`critique-claude.md`, `critique-codex.md`).
No new claims — every line below traces to a seat, a critique, or a cited E-id. Binding gates
honored throughout: the sufficiency gate (E-P1/E-P2 — all funnel/CAC/conversion claims ASSUMED),
the WTP self-warning (no pricing lock at current n), and the WTP anchor gap (no Study-1 $1,049
reaction may be cited as validation of the live $1,449; **both critiques additionally strike
E-D15's absolute "no clean $2,059 reaction" wording** — 2 of 5 Study-2 sessions delivered the
mandatory $2,059 probe cleanly (E-D9), so cite E-D9/E-D10, not E-D15, for $2,059 reactions).

---

## 1. Ranked findings

**F1 — The business model has zero recorded revenue and zero recorded field contact, but the two
are not the same zero.** DEMAND-LEDGER: $0 revenue, 0 checkout sessions, 0 confirmed sends, 0
replies, 0 signed design partners, 0 waitlist entries, 0 npm downloads, 0 GitHub stars (repo
never public). **CORROBORATED** across every memo (S1, S2, S3, T1, T3) and both critiques agree
the zeroes themselves are real. **Both critiques bind a correction the strategy seats did not
make**: the ledger proves "0 confirmed sends," not "the emails sat unsent" or "zero executed
field contact" — an absent send-log entry is a recordkeeping gap, not proof of inaction (off-repo
send, deliverability failure, or a deliberate hold are equally consistent with the same zero).
Carry F1 in its narrow form only.

**F2 — The live Compliance price ($1,449, ADR-0373) has never been shown to a real buyer at any
discount level.** Every Study-1 reaction (9 of 10 heard $1,049 neutral-to-positive; 1 dissent
called $1,049 a credibility-damaging lowball) tested a price 38% below the live anchor
(spot-audit §D, binding). **CORROBORATED** — S1, S2, S3, S4 all state this; both critiques verify
the citation holds for the *Compliance* SKU specifically. Codex's correction: this is narrower
than several memos word it — Study 2 did deliver two clean $2,059 (Everything-tier) reactions
(#1 "surprisingly cheap"; #3, #4 "a little expensive," anchored at $1,000–$1,200 expectation),
so "no buyer has ever reacted to any Caisson price" (S3's framing) is **FALSE as worded**; the
accurate claim is narrower and still damning: _no buyer has reacted to the Compliance SKU at its
current $1,449 price point._

**F3 — The only price-direction signal in the corpus is contested, not unidirectional.** S4
claims "the only price-credibility signal on record points upward, not down," citing the #12
lowball dissent and the #1 "surprisingly cheap" reaction while omitting E-D10's two below-anchor
reactions ($1,000/$1,200 expectation, "a little expensive") from the same evidence item S4 itself
cites elsewhere. **Both critiques independently flag this as a cherry-pick** — critique-claude
calls it "the cleanest cherry-pick in the eight memos"; critique-codex calls it "selection bias
disguised as positioning discipline." S3's framing is the one that survives: price direction is
**CONTESTED by sample**, n is too small to conclude either way, and that ambiguity is itself the
finding — not a resolved "hold or raise" signal.

**F4 — The design-partner discount structure cannot validate the list price it is being asked to
validate.** ADR-0297's 40% first-five discount on $1,449 nets $869.40/partner. S1 computes this
correctly and uses it as a _cost-coverage_ floor (one partner covers 6.7–10.9 months of the
$80–130 non-inference stack). **Codex's critique is the sharper and non-overlapping point**: S1,
S2, and S3 all still treat "show $1,449 verbatim, close a discounted partner" as if closing
validates $1,449 — it validates $869.40. A buyer who transacts at the discount has not told
anyone whether $1,449 self-serve clears. **This is a load-bearing correction**: any 30-day
experiment that reports a signed design partner as "price validated" is answering the wrong
question. If the cohort is meant to buy proof/case-study rights (which is what ADR-0297 actually
prices), say so — do not double-count it as WTP evidence for the un-discounted price.

**F5 — The compliance wedge itself was spared the adversarial standard applied to everything
else in the pack.** Every strategy seat (S1, S2, S3, S4) treats ADR-0040's hero frame as
essentially settled, and S2 — the seat whose mandate is contrarian inversion — explicitly
declines to invert the wedge, calling the case against it "weak." **Both critiques independently
name this as the board's most important structural finding.** The wedge's evidentiary stack is:
E-D16 (WEAK-tier keyword-CPC proxy, explicitly not conversion evidence), E-B5 (an inferred
complaint synthesis about GRC-SaaS buyers, not evidence they will buy a source-code product),
E-D1 (ten reactions to a retired, 38%-lower price from an "ICP-adjacent" panel with acknowledged
off-fit participants), and E-D3 (a 68%-"Other" survey panel). Stacked, this supports "worth
testing" — it does not support "corroborated" or "the wedge is right." Carry the wedge as a
**testable thesis**, not a validated one.

**F6 — The unvalidated assumption underneath the whole revenue model is a buyer-map gap, not a
demand gap.** Codex's critique names this precisely and it is not present in any of the eight
memos: the model requires that the technical champion who values fail-closed RLS / WORM evidence
/ owned source is close enough to the person who controls a compliance budget that a self-serve,
one-time code purchase can close _without_ a services or procurement layer. Nothing in the corpus
establishes that chain — E-D5 separates technical inspection from the economic buyer's proof
needs; E-D11 says ownership does not imply self-sufficiency; DEMAND-LEDGER contains no
procurement event, security review, or paid buyer of any kind. The alternative hypothesis (the
champion likes the code, the economic buyer buys an auditor or a platform, and nobody owns the
gap between them) is not tested by any proposed 30-day instrument.

**F7 — The cost side of the model is real and small; the missing side is cost-to-serve, not
cost-to-run.** T1's non-inference stack figure ($80–130/mo, E-D21) is solid and undisputed. What
no seat priced (Codex's critique, "success may be more dangerous than failure"): support labor,
security-response, patch/framework-update, and auditor-assistance tail for a regulated design
partner who has already flagged support-scope ambiguity (E-D11) as a live objection. S1's cash
math excludes support labor by name. One signed partner could be cash-positive and
capacity-negative for a solo operator — the "one paid partner" pass bar used by three memos has
no cost-to-serve condition attached.

**F8 — The proposed 30-day instruments answer at least four different questions and are being
scored as one.** Codex's critique decomposes this cleanly and no strategy-track memo does:
a discounted design-partner close tests a discounted relationship (F4); a Show HN star tests
developer attention, not regulated-buyer purchase authority; an AEO citation tests indexability,
not demand; a cold-email non-response tests list quality, sender reputation, offer, copy,
deliverability, and timing simultaneously, not demand alone. Treating all of these as
undifferentiated "market contact" hides which confound produced a null result.

---

## 2. Pivot-vector comparison (S2's three vectors + every seat's position)

S2 is the only seat to propose named pivot vectors, scored against OPERATOR-CONSTRAINTS (solo,
no raise, no services shape, no regulated-liability role; kernel/WORM abandonment explicitly
in-bounds per the operator's struck no-go). S2 itself concludes: **do not pivot the wedge, invert
the sequencing** — treat the vectors as pre-registered kill-criteria experiments, not a decision.

| Vector                                                                                                                    | S2's argument                                                                                                                                                                                                                 | Cheapest 30-day test                                                                                                        | Other seats' bearing                                                                                                                                                                                                             | Critique flags                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **V1 — Unbundle**: lead with a single-module OSS wedge (audit-worm/evidence), demote the $1,449 bundle until proof exists | Third-party proof (E-D5) is the #1 blocker; a cold $1,449 whole-codebase ask is the maximum-trust ask from a zero-social-footprint company (E-B1); AuditKit proves standalone audit-chain demand exists at $99–999/mo (E-D18) | Flip the already-green `caisson-oss` mirror, Show HN, wire the ADR-0085 Resend seam (currently inert, zero confirmed count) | T1's freeze recommendation is compatible (no new build required); T4 notes the meta-bundle manifests are cheap to keep either way                                                                                                | **Codex**: "a public OSS/module launch will create commercial proof rather than attract only free users" is itself an unvalidated assumption — ADR-0094 describes the licensing boundary, it does not validate the conversion mechanism from stars to sales                                                                                                         |
| **V2 — Re-wedge to AI-spend governance** (ai-meter first, compliance as upsell)                                           | Token-budget governance shows demand _forming now_ (E-B7/E-B8); the compliance flank is crowding (Sentrik/Comp AI/Probo/AuditKit/MS tooling, E-C1–E-C4)                                                                       | Standalone landing page + Show HN for pre-call budget enforcement, no repricing/repositioning of the main site              | S2 itself grades this the **weakest of the three** — "the compliance buyer has budget (E-D16); the token-governance buyer may expect free" — proposed as a flanking test, not a substitution                                     | none additional; S2's own honest-weight caveat stands                                                                                                                                                                                                                                                                                                               |
| **V3 — Regime pivot**: GDPR/PCI/ISO + EU AI Act framing, de-Americanize the copy                                          | 5/12 Study-1 buyers named GDPR/PCI/ISO as their actual regime, none led with HIPAA, one made it an explicit dealbreaker (E-D4); Art. 50 obligations land 2026-08-02, correctable rumor window closing                         | Ship the correct-the-rumor + crosswalk page before 2026-08-02                                                               | S3 and S4 independently converge on the _same underlying fact_ (E-D4/E-D7) without calling it a pivot vector — they treat it as a copy fix, not a positioning pivot, which is the more conservative and better-supported reading | **Both critiques**: a rushed regulatory-commentary piece under a 10-day deadline, from a trust-market vendor whose brand claim is "never invented," carries an asymmetric-damage downside (being wrong in public about Art. 50) that no seat priced against the hook's upside; the spot-audit's Dec-2026 grace-period nuance is a live trap for exactly this vector |
| **Attacked, not proposed — Probo-drift ("Compliance, Done for You")**                                                     | S2 refuses to argue it: requires services delivery and edges toward compliance-officer-of-record liability, both explicit operator no-go zones                                                                                | —                                                                                                                           | No seat argues for this vector                                                                                                                                                                                                   | none — this is the one point of unanimous, uncontested agreement in the whole pack                                                                                                                                                                                                                                                                                  |

**What the critiques add that S2's table does not**: neither V1 nor V2 has a validated
conversion mechanism (stars→sales, or landing-page signal→paying governance buyer) — both are
genuinely cheap information, not validated wedges-in-waiting. V3 is the only vector with a
hard-dated urgency, and it is also the only one whose downside (public regulatory error) both
critiques call unpriced by every seat that proposed it.

---

## 3. Pricing findings (EXPERIMENT-FIRST, no lock)

1. **The live $1,449 Compliance price is untested at any real discount tier and undiscounted
   tier alike.** No pricing recommendation may cite Study-1 $1,049 data as validation of $1,449
   (spot-audit, binding, honored by all seats).
2. **The only executable near-term price test (ADR-0297's discounted design-partner motion)
   tests $869.40, not $1,449** (F4, Codex correction) — if this is the chosen 30-day instrument,
   its result must be labeled as discounted-relationship validation, not list-price WTP.
3. **Price direction is contested, not resolved** (F3) — S4's "upward-only" read is a documented
   cherry-pick per both critiques; the corpus contains reactions on both sides of $1,449
   (above: #12's lowball, #1's "surprisingly cheap" at $2,059; below: #3/#4's "a little
   expensive" at $2,059, both below-anchor on expectation). Neither direction is corroborated;
   both are single-digit-n signals.
4. **The externally-commissioned report's $2,999–$4,999 recommendation (E-D17) is WEAK tier and
   self-labeled "estimate"** — it is 3–5× the operator-locked anchors and should not be read as a
   third data point toward "raise," only as a documented outlier the operator has already declined
   to follow (ADR-0304).
5. **The renewal ratio (40%, ADR-0297) draws no buyer pushback in the corpus** (E-D6) — the
   objection cluster is month-13 ambiguity, not the percentage. This is the one pricing-adjacent
   finding in the pack with no dissent across seats or critiques: fix the answer's _placement_
   (T3: it exists on `/marketplace/plans`, three clicks deep, not at the homepage decision point;
   S3's "unresolved" framing is **contradicted by the deployed source** per both critiques — the
   homepage does state "support is included... a real person on email and Discord," so the
   residual is a placement/scope gap, not an absent answer), not the number.
6. **No pricing lock is recommended by any seat or critique.** Every memo that touches price
   (S1, S2, S3, S4) explicitly defers to the sufficiency gate; the two critiques' only addition is
   procedural: separate the pricing question from the discounted-partner question and from the
   demand question before running any instrument (F8), or the 30-day result will be
   uninterpretable.

---

## 4. Pivot vs. persevere — the actual disagreement map

**Persevere-on-wedge, invert-sequencing (the board's modal position — S1, S2, S3, S4, T1):** keep
ADR-0040's compliance hero and the $1,449 anchor; the binding constraint is zero executed market
contact, not product readiness or wedge choice; send the five drafted design-partner emails this
week, run the named-but-never-executed real-ICP round at the live anchor, fix message-match gaps
(ISO 27001 naming, month-13 placement) as pure listening, not strategy.

**Persevere-but-gate-on-proof-first (T2, joined by T3's independent finding):** hold the paid
launch gate — and, per T3, hold public/seeded traffic generally — until four specific technical
receipts exist (live COMPLIANCE-mode WORM proof, deployed-pooler RLS attestation, WORM/DB
split-brain recovery proof, KMS-backed license signing) and until the site's own falsifiable
claims (dead install command, sandbox-only checkout, WORM-mode overclaim) are corrected. **Both
critiques identify this as the pack's sharpest unreconciled contradiction**: S1/S2/S3 all
recommend "send emails now, show the live artifact" on the premise that "all technical go-live
gates are GREEN" (DEMAND-LEDGER §0) — but that premise is scoped, in the ledger's own text, to
the **free-tier flip's engineering gates**, not to paid-launch readiness, and T2/T3 independently
show the paid/public artifact is not yet true to its own claims. No strategy seat cross-read T2 or
T3; no tech seat flagged the collision either. **Both critiques converge on the same resolution**:
this is not a sequencing debate between two board factions, it is a dependency — fix the
now-public falsifiable claims (T2 finding 1, T3 finding 1) inside the same week as, and before,
any buyer sees the artifact, then send the emails.

**Pivot-the-sequencing-not-the-wedge (S2's committed position, the closest thing to a "pivot"
recommendation in the pack):** do not change ADR-0040; invert what gets built next — contact
before further build, OSS-flip before paid-bundle polish, with V1 as the named default fallback
if 30 days of _executed_ contact returns zero replies/stars/waitlist entries.

**No seat or critique recommends an immediate hard pivot away from the compliance wedge.** The
closest structural dissent is Codex's critique, which argues the wedge was never adversarially
tested to begin with (F5) and that the buyer-map gap (F6) is a more fundamental unknown than
sequencing — but even this critique does not recommend pivoting; it recommends testing the
buyer-map assumption directly, as a fifth instrument alongside S2's three vectors, before calling
any 30-day result a verdict on the wedge.

**Kill/consolidate is separately, unanimously "not yet" on the architecture side** (T1 vs. T4
dissent preserved below) but that disagreement is about internal cost, not the business model or
pricing, and does not change any pivot/persevere position above.

---

## 5. Agree/disagree map

| Point                                                      | Agree                                             | Disagree                                                                                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zero recorded revenue/contact is real                      | S1, S2, S3, T1, T3, both critiques                | none — critiques narrow the _causal_ framing (recordkeeping gap ≠ inaction), not the fact                                                         |
| Compliance wedge is basically validated                    | S1, S2 (explicitly declines to invert it), S3, S4 | **Both critiques**: unvalidated — evidentiary stack is WEAK/proxy-tier throughout (F5)                                                            |
| $1,449 has zero buyer evidence                             | S1, S2, S3, S4 (unanimous)                        | none                                                                                                                                              |
| Price direction reads "upward only"                        | S4                                                | S3 (contested-by-sample, more defensible); **both critiques side with S3** against S4's framing (F3)                                              |
| A signed discounted partner validates $1,449               | Implicit in S1/S2/S3's 30-day recommendation      | **Codex critique, explicit**: it validates $869.40, not $1,449 (F4)                                                                               |
| "All technical gates are green" licenses buyer contact now | S1, S2, S3                                        | T2 (four launch-blocking findings), T3 (artifact's first interaction fails), **both critiques** (the phrase is scoped to the free-tier flip only) |
| 30 days of outreach is the right single instrument         | S1, S2, S3 (near-identical wording)               | **Codex critique**: at least four separate instruments are being conflated (F8)                                                                   |
| Kill/merge any architecture surface now                    | T1 (scale seller-plane to zero, supersede 4 ADRs) | T4 (kill nothing, merge nothing — every candidate is ADR-locked); **both critiques preserve this as real, unaveraged dissent**                    |
| A hard pivot off the compliance wedge is warranted today   | none                                              | none — closest is Codex naming the buyer-map gap as untested, not as grounds for pivoting yet                                                     |

---

## Minority Report

_(verbatim, per contract — the strongest dissenting voice preserved against synthesis
laundering)_

From **critique-codex.md**:

> This board did not produce eight independent reads. It produced one dominant story in eight
> dialects: Caisson's compliance wedge is basically right, the product is basically ready, the
> missing move is market contact, the live price should be held while tested, and further
> building should stop. The contact-before-more-build conclusion is probably directionally right.
> The evidence does not justify the causal certainty wrapped around it. The board repeatedly
> mistakes an activity ledger with no recorded send for proof that no send occurred, a free-tier
> flipgate receipt for paid-product readiness, paid research reactions for a coherent buyer
> market, and a discounted design-partner purchase for validation of a list price the buyer will
> not actually pay. The board's gravest defect is not excessive pessimism. It is premature
> convergence. Every seat except T2 protects the basic product thesis; even S2's "contrarian"
> inversion declines to invert the wedge... Nothing in the pack demonstrates that buyer-and-
> authority combination [that the technical champion and the economic buyer are close enough for
> a self-serve source-code purchase to close].

And, on the specific danger of the board's own headline recommendation:

> The proposed experiment cannot distinguish demand failure from transaction failure. The board
> wants a paid partner in 30 days while the payment/banking gates are pending and the only live
> terms include a 40% discount. A zero-sales result would conflate lack of demand, inability to
> pay, procurement delay, list quality, and product unreadiness. A sale would validate $869.40
> partner terms, not $1,449 self-serve terms. The headline experiment is therefore incapable of
> producing the binary conclusion several seats want from it... Success may be more dangerous
> than failure. One customer can therefore produce positive cash and negative solo-founder
> capacity. The board's "one paid partner" pass bar has no cost-to-serve or support-boundary
> condition.

From **critique-claude.md**, the same structural point from the opposite direction (evidence
discipline rather than commercial logic):

> The board's headline consensus ("send the emails now, everything is ready") was pre-written by
> the demand ledger's editorializing and is factually incompatible with the tech track's two
> verified findings (dead install command, WORM overclaim) that no seat cross-read. ... The
> synthesis that matters is one sentence long: fix the three now-public falsifiable claims this
> week, then send the five emails the same week — and diagnose, out loud, why they weren't sent
> eleven days ago. Any synthesis longer than that which drops the T2/T3 preconditions, softens
> S1's stop-spend tripwire, or quotes the 193→632 statistic is laundering.

---

## Dissent Ledger

| id    | claim (verbatim)                                                                                                                                                                                                                | seat/source                                       | disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BIZ-1 | "zero paid partners at day 30 stops further product spend and reopens the wedge or pivot board."                                                                                                                                | S1                                                | **PRESERVED as stated.** This is the pack's only stop-spend tripwire with a dollar figure attached (S1's $730–$780 sprint cap). Do not soften to "reassess at 30 days" — both critiques name this exact softening as the most likely laundering failure mode.                                                                                                                                                                                                           |
| BIZ-2 | "The cheapest unit of compounding available today is a sent email."                                                                                                                                                             | S2                                                | **PRESERVED**, with the F1 correction attached: the claim's force depends on "the emails sat unsent" (revealed preference), which is stronger than what the ledger actually proves ("0 confirmed sends"). Carry the compounding-cost argument; do not carry the unproven causal diagnosis of _why_ the sends are at zero.                                                                                                                                               |
| BIZ-3 | "None of us has ever seen the price you are actually charging."                                                                                                                                                                 | S3                                                | **PRESERVED in corrected form**: true for the Compliance SKU ($1,449); false as a blanket claim about "any Caisson price" (E-D10 records two clean $2,059 reactions). Use the narrower, still-true form.                                                                                                                                                                                                                                                                |
| BIZ-4 | "'Code-owned compliance' as a standalone category frame is invented — nobody searches it."                                                                                                                                      | S4                                                | **PRESERVED**, but flagged FALSE-as-cited by critique-codex: E-D16 shows compliance keywords are expensive and SERP-owned by finished platforms; it does not report zero search volume for an owned-code frame specifically. The entry-frame recommendation (walk in on the searched GRC term, not an invented category name) survives; the citation for "nobody searches it" does not.                                                                                 |
| BIZ-5 | A signed $869.40 design partner will be treated by the board as validating the $1,449 list price.                                                                                                                               | implicit in S1/S2/S3's 30-day recommendation      | **REJECTED as stated — this is the correction, not a preserved claim.** Per Codex's critique (F4): a discounted close validates the discounted relationship. Any synthesis or operator decision must not count it as list-price WTP evidence.                                                                                                                                                                                                                           |
| BIZ-6 | "All technical go-live gates are green" licenses immediate buyer contact and a live artifact demo.                                                                                                                              | S1, S2 (quoting DEMAND-LEDGER §0 approvingly), S3 | **REJECTED as stated — scope correction required.** The phrase is true only of the free-tier flip's engineering gates (DEMAND-LEDGER §0's own wording). T2 (4 launch-blocking findings) and T3 (dead install command, sandbox checkout) show the paid/public artifact is not ready; both critiques independently name this as the board's most consequential unreconciled contradiction. Any contact plan must fix T2/T3's findings first, in the same week, not after. |
| BIZ-7 | "Kill: nothing... an empty kill list is this audit's honest finding, not an evasion." (T4) vs. "The seller plane is deliberate reckless debt at this stage" — scale docs/support-bot to zero, superseding four named ADRs. (T1) | T4 / T1                                           | **BOTH PRESERVED as live, unreconciled dissent** — not a business-model or pricing question, but flagged here per instruction not to average it away: this is a real disagreement about whether pre-revenue architecture spend is itself a business-model risk (T1's view) or an ADR-locked, already-priced cost (T4's view).                                                                                                                                           |

---

**No new claims.** Every finding, vector, pricing note, and ledger row above cites a seat, a
critique, or a named E-id already in the corpus; where a memo's wording was corrected, the
correction is itself sourced to one or both critiques, not invented here.

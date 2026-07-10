---
title: "WTP re-synthesis — qual (final) × quant legs (partial), 2026-07-09"
date: 2026-07-09
status: interim — quant legs still filling (776545 at 37/60 · 445432 at 26/60, both recruits active); NOTHING here locks
sources:
  - prelaunch-fanout-2026-07/cookiy-deep-analysis-2026-07-07.md (qual, final — the verification layer over 45 transcripts)
  - prelaunch-fanout-2026-07/SYNTHESIS.md (pre-launch research synthesis, D1–D8 menu)
  - Cookiy survey 776545 (positioning frame test) — 38 completes pulled 2026-07-09
  - Cookiy survey 445432 (Van Westendorp pricing v2) — 26 completes pulled 2026-07-09
method: >
  Raw responses pulled via cookiy_quant_survey_raw_responses; VW rows filtered for
  monotonicity (TC ≤ CH ≤ EX ≤ TE, TE > 0) and troll rows removed; frame-test prices
  trimmed to 0 < p < 50k. Computation script (data inline):
  scratchpad quant.ts, this session. Aggregates cross-checked against
  cookiy_quant_survey_report.
---

# WTP re-synthesis — what changes now that partial quant is in

## TL;DR

1. **The quant panel is off-ICP, and that caps what these legs can ever prove.** 68%
   (frame) / 62% (VW) chose role "Other"; only 10/38 build compliance-subject software;
   only 3/26 VW respondents are both ICP-claimed AND internally consistent. **Neither leg
   can validate the $1,049 anchor at N=60.** The qual analysis's data gap — _no real ICP
   buyer has ever reacted to the actual price_ — stands unfilled and will remain unfilled
   when these recruits complete.
2. **The positioning frame test is the usable leg, and it has a real result: the
   platform-led frame (Description 2) wins 3:1** among respondents with a preference
   (18 vs 6, with 14 no-difference), wins on clarity (73.7% clear vs 50.0% for
   compliance-led), and does **not** depress price expectations (paired deltas: 13 up /
   10 down / 11 same). The compliance-adjacent subset agrees (6 vs 3).
3. **The VW open-ended numbers are consumer-frame garbage ($15 bargain / $45 too-expensive
   medians) — but the price ladder tells a different story:** shown the actual rungs, 58%
   rate $1,049 "fair" or "expensive but I'd consider it" (69% at $649, 46% at $1,499,
   23% at $2,499). Presentation/anchoring dominates gut pricing even in an off-ICP panel —
   which is directionally the same lesson as qual ranked action #3 (anchor against build
   cost on-page).
4. **One genuine human convergence with qual:** the frame test's "what would you need
   before taking $1,000 seriously" open text is dominated by **testimonials / reviews /
   proof** — the same social-proof gate the qual critic flagged as the study's biggest
   under-count (~31/40 synthetics) and the one gate Caisson can't satisfy pre-launch.
   That's now corroborated by real (albeit off-ICP) humans. Evidence-pack + interim
   social-proof levers (ADR-0275 evidence pack, open Base as peer-reviewable proof)
   remain the top-ROI conversion work.
5. **Recruit-spend fork for the operator** (§6): the VW leg's remaining ~34 completes buy
   more of the same population. Options below — recommendation is to redirect toward the
   real-ICP qual round the deep analysis already called for, but the recruits are
   funded/active and this is an operator call.

## 1. Where the two surveys stand (2026-07-09)

| Leg                       | Survey | Completes        | Recruit           | Fill |
| ------------------------- | ------ | ---------------- | ----------------- | ---- |
| Positioning frame test    | 776545 | 37 (+13 partial) | active, 60 target | ~62% |
| Van Westendorp pricing v2 | 445432 | 26 (+13 partial) | active, 60 target | ~43% |

Zero drop-off inside both questionnaires (100% completion once started) — the instruments
are fine; the population is the problem.

## 2. The binding caveat: panel composition

- **Frame test:** ROLE = 68.4% "Other"; the target buyer (compliance-requirements CTO) is
  1/38. The REG screen ("do you build software subject to SOC 2/HIPAA/GDPR…") catches
  10/38 as even compliance-adjacent.
- **VW:** ROLE = 61.5% "Other"; A1–A3 (ICP-claimed) = 9/26, and 6 of those 9 fail
  Van Westendorp monotonicity (e.g. "too expensive" below "bargain"), leaving **n=3**
  clean ICP rows. One respondent straight-lined $250k trolling; one answered "honestly
  idk"; one open-text response was obscene.
- Mirror of the qual finding: the deep analysis showed the 5 real interviewees were
  mostly off-ICP; the quant panel repeats it at scale. **General-panel recruiting cannot
  reach this buyer.** Treat that as the program's confirmed lesson, not a surprise.

## 3. Frame test — the leg that works (within-subject, so composition-robust)

The comprehension/preference comparison is within-subject (every respondent saw both
descriptions), so it survives an off-ICP panel far better than absolute WTP does.

| Measure                         | Frame A (compliance-led) | Frame B (platform-led, compliance flagship) |
| ------------------------------- | ------------------------ | ------------------------------------------- |
| "Very/mostly clear"             | 50.0%                    | **73.7%**                                   |
| "Could not tell what it is"     | 18.4%                    | 13.2%                                       |
| Would explore (def/prob)        | 52.6%                    | 55.2%                                       |
| Forced choice                   | 6                        | **18** (14 no-difference)                   |
| Median expected price (trimmed) | $80                      | $100                                        |
| Paired price delta (B vs A)     | —                        | 13 up · 10 down · 11 same                   |

- The win is **clarity-driven** ("easier to understand", "less jargon" dominate the WHY
  text), not appeal-driven — appeal is a wash.
- Platform-led framing does **not** cheapen the product: expected price nudges _up_.
- Compliance-adjacent subset (REG=Y, n=10): B wins 6–3. The one place A holds its own is
  respondents writing compliance-first rationales ("immediately addresses the most
  critical need for regulated industries").
- **Confound to keep honest:** Frame A was always shown first — some of B's clarity edge
  is a second-reading/order effect. The 3:1 forced-choice margin is too wide to be pure
  order effect, but don't quote 73.7-vs-50 as a clean causal number.
- **Read against D1 (SYNTHESIS.md §1):** this is direct evidence for surfacing the
  six-bundle/platform story earlier (options a/b), and against a pure compliance-only
  first impression (option d). It does NOT adjudicate hero-swap vs grid-after-hero; the
  wedge-first _acquisition_ logic (compliance CPC, `/compliance` repoint) is untouched —
  the frame test measures a cold reader's first-screen comprehension, not channel
  economics.

## 4. Van Westendorp — mostly unusable, one useful wrinkle

**Open-ended price generation (the VW core) is consumer-frame:** clean-subset medians
(n=9 after monotonicity + junk filtering) are TC $5 / CH $15 / EX $33 / TE $45. The clean
ICP subset (n=3) is the same shape ($5/$15/$35/$45). These respondents are pricing a
consumer app. **Do not compute or cite VW crossing points from this leg — at any fill
level.**

**But the price ladder (LADD) — same respondents, shown the real rungs — reads
differently:**

| Rung   | Too cheap–suspicious | Fair | Expensive but consider | Too expensive, no | Fair-or-consider |
| ------ | -------------------- | ---- | ---------------------- | ----------------- | ---------------- |
| $649   | 2                    | 15   | 3                      | 6                 | **69%**          |
| $1,049 | 2                    | 4    | 11                     | 9                 | **58%**          |
| $1,499 | 2                    | 7    | 5                      | 12                | 46%              |
| $2,499 | 2                    | 3    | 3                      | 18                | 23%              |

The same panel whose median unanchored "too expensive" was $45 rates $1,049 as
fair-or-considerable 58% of the time when the number is presented. Weak evidence in
absolute terms (n=26, off-ICP, some straight-lining) — but the _divergence_ is the
finding: **presentation and anchoring dominate gut price generation.** This is quant-side
corroboration for qual ranked action #3 (anchor $1,049 against internal build cost
on-page) and for holding the anchor rather than discounting toward gut numbers.

**Updates model (40% ≈ $419/yr or $499/yr Developer plan):** 58% fair-or-would-pay
overall (27% fair · 31% a-bit-high-but-pay · 31% stay-on-purchased · 12% different
model); ICP subset 7/9 fair-or-pay. Consistent with qual: **the ratio is not the
problem** — nobody proposes a different number; the objection cluster in qual was
12-month _ambiguity_, which a survey radio can't test.

**BUDGET open text:** mostly noise; the few numeric answers ($200–$3,233, one $1,500)
sit at or above the anchor, weakly echoing the qual build-cost-proxy pattern.

## 5. Convergence matrix — qual (final) × quant (partial)

| Claim (from the qual deep analysis)                                 | Quant says                                                                              | Net                                                                                                       |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Proof/social-proof gates trust; case studies the #1 uncovered gate  | MISSING text dominated by testimonials/reviews/proof                                    | **Converges (now human-corroborated)** — evidence pack + interim proof levers stay top-ROI                |
| Hold the $1,049 anchor; constraint is proof + terms, not level (D2) | Ladder: 58% fair-or-consider at $1,049 even off-ICP; unanchored gut numbers meaningless | **Weakly converges** — nothing here argues a cut; anchoring effect supports build-cost comparator on-page |
| 40%/X9 renewal ratio draws no pushback; ambiguity is the issue (D3) | 58% fair-or-pay (ICP subset 7/9); ~31% would stay on purchased version                  | **Converges** — the stay-on-purchased third is exactly who the perpetual + patch-continuity copy serves   |
| Modular-vs-platform polarization real, maturity axis fabricated     | Frame test: platform-led framing clearer + preferred 3:1, price-neutral                 | **Compatible** — platform _story_ wins the first screen; bundle SKUs still the purchase shape             |
| No real ICP buyer has reacted to the actual anchor (data gap)       | Panel off-ICP; gap NOT filled, won't be at 60/60                                        | **Confirmed and still open** — the ≥5 real-ICP interview round remains the only instrument that closes it |
| "$1,049 = extreme bargain" (vendor claim) is manufactured           | Zero bargain language in quant either; 2/26 "too cheap–suspicious" at $1,049            | **Converges (against the vendor claim)**                                                                  |

## 6. Operator forks surfaced (not decided)

1. **VW recruit spend (445432, ~34 completes outstanding).**
   - (a) Let it fill — sunk/funded, ladder + updates-model cells gain precision; accept
     the leg is presentation-reaction data, not WTP.
   - (b) Stop or retarget the recruit; redirect remaining budget toward the
     **≥5 real-ICP qual round that reaches the pricing screen** (the deep analysis's
     standing recommendation and the only closer of the D2/D3 data gap).
   - Research read [medium confidence]: (b) — the leg's marginal 34 responses cannot
     change any decision this program feeds. But it's funded and cheap; (a) costs only
     attention.
2. **Frame-test recruit (776545, ~23 outstanding):** let it fill [high confidence] — the
   within-subject comparison is the one measurement working as designed; more N tightens
   the D1-relevant result at zero marginal decision-risk.
3. **Pricing picker timing:** the tracker gates the pricing picker on "quant maturation."
   Given §2, maturation will not add ICP validity. The picker can run on qual(final) +
   frame(mature) + ladder(directional) whenever the operator wants; waiting for 60/60
   buys precision on the wrong population.

## 7. What did NOT change

- Every D2/D3 recommendation in the qual deep analysis stands verbatim (hold anchor ·
  answer the 12-month question on the pricing page · renewal as security-patch
  continuity · proof artifacts next to the price · licensing terms at checkout · trial
  path). Nothing in the partial quant contradicts any of them; two now have human
  corroboration (social proof, anchor-hold).
- The SYNTHESIS.md D1 menu is unchanged in structure; the frame test adds the first
  buyer-facing evidence _within_ it (toward a/b, against d).

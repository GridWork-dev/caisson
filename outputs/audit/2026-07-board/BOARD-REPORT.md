# BOARD-REPORT — caisson board audit, Phase-4 master synthesis (2026-07-23)

Inputs: memo-positioning.md, memo-business-model.md, memo-product-site.md,
memo-tech-consolidation.md, critique-claude.md, critique-codex.md, EVIDENCE.md (binding
gates), EVIDENCE-spot-audit.md, OPERATOR-CONSTRAINTS.md; the 8 Phase-1 seat memos
consulted for verbatim quotes only. **No new claims** — every line traces to a domain
memo, a critique, or a cited E-id. Binding constraints honored: the sufficiency gate
(E-P1/E-P2 — all funnel/CAC/conversion claims ASSUMED), the WTP self-warning (no
pricing lock at current n — fail-closed), the spot-audit §D anchor correction
(ADR-0373 $1,449 supersedes ADR-0304's $1,049), and the two critiques' anti-laundering
instructions, applied verbatim in §2 and §4.

---

## 1. Ranked cross-track findings

**1. The board's modal recommendation and its modal factual finding contradict each
other, and the resolution is a dependency, not a sequencing debate.** S1/S2/S3 (and T1)
recommend immediate buyer contact on the premise "all technical go-live gates are GREEN"
(DEMAND-LEDGER §0); that receipt is scoped, in the ledger's own text, to the free-tier
flip's engineering gates only. T2 (four launch-blocking findings) and T3 (dead install
command, sandbox checkout) factually refute the premise as applied to the paid/public
artifact — and no strategy seat cross-read the tech track, nor vice versa. Both critiques
converge on the same merge: fix the now-public falsifiable claims _inside_ the same week
as, and before, any buyer sees the artifact — then send the emails. _(PRD-10, BIZ-6,
POS-15, TEC-1; critique-claude §4-1, critique-codex checklist-3.)_

**2. The site is publishing a false claim and a dead claim right now, on a publicly
reachable page, under a brand whose spine is "claims are scraped and dated, never
invented" (E-B3).** The hero and closing CTA render `bunx @caisson-sh/cli@latest` — a
never-published package — beside a success-tone "ready" chip (DIS-T3, verified at
`dual-door-hero.tsx:119-121`); the homepage claims COMPLIANCE-mode WORM with
leaked-root-key resistance while `S3ArtifactStore` defaults to GOVERNANCE and the sole
live test never exercises COMPLIANCE (DIS-T2, verified). With the CF-Access gate no
longer observably up (spot-audit/E-B2), the risk is present-tense; every memo priced it
future-tense (critique-claude 1d-1). These two items are **preconditions adjacent to any
send-the-emails decision** (§3 D1/D2), not polish.

**3. The live $1,449 Compliance price has never been shown to any buyer — the board's
one clean, unanimous, critique-surviving consensus.** Every Study-1 reaction (n=10 of 12)
was to $1,049, 38% lower; Study 2 never tested $1,449 either. Codex's narrowing holds:
two clean $2,059 Everything-tier probes exist (E-D9/E-D10), so "no buyer has ever seen
any Caisson price" is false as worded — the true, still-damning claim is _no buyer has
reacted to the Compliance SKU at $1,449._ _(POS-2, BIZ-3, F2; E-D1, E-D15,
spot-audit §D binding.)_

**4. The corpus proves 0 confirmed sends — not that no send occurred, and not founder
avoidance.** The demand ledger's zeroes (0 sends, 0 replies, 0 partners, 0 waitlist,
$0 revenue, 0 checkout sessions) are real and corroborated everywhere; the causal wording
four seats layered on ("sat unsent," "zero executed field contact") crosses from a
recordkeeping absence to an unproven diagnosis (critique-codex 1-1). Carry the narrow
form; it still fully supports the go-make-contact recommendation. _(POS-1, F1;
DEMAND-LEDGER §1.)_

**5. A signed design partner validates $869.40, not $1,449.** ADR-0297's 40% first-five
discount nets $869.40; S1/S2/S3 all pair "show $1,449 verbatim" with the discounted
motion and implicitly score a close as price validation. Codex's correction is
load-bearing: a discounted close validates a discounted relationship (or a purchase of
proof/case-study rights — which is what ADR-0297 actually prices); it is not list-price
WTP evidence. _(BIZ-5, F4.)_

**6. The compliance wedge is a testable thesis, not a validated one — it was spared the
adversarial standard applied to everything else.** Its whole evidentiary stack is proxy:
E-D16 (WEAK keyword economics, explicitly not conversion evidence), E-B5 (inferred
complaint synthesis), E-D1 (a retired price, ICP-adjacent panel), E-D3 (68%-"Other"
survey). Even S2, the contrarian seat, declined to invert it. Both critiques
independently name this the board's most important structural defect. No seat or critique
recommends pivoting today. _(POS-10, F5, POS-9.)_

**7. The load-bearing commercial assumption was never named by any seat: that the
technical champion who wants owned compliance code is close enough to the person who
controls a compliance budget for a self-serve, one-time purchase to close without a
services or procurement layer.** Nothing in the corpus establishes that chain (E-D5,
E-D7, E-D10, E-D11, E-B5; no procurement event, security review, or paid buyer anywhere
in the ledger). The alternative — champion likes the code, economic buyer buys an auditor
or platform, nobody owns the gap — is untested by any proposed instrument. _(POS-11, F6;
raised only by critique-codex.)_

**8. Price direction is contested by sample, not "upward only" — the struck statistic
stays struck.** S4's "the only price-credibility signal on record points upward" is a
verified cherry-pick (both critiques): E-D10 records two below-anchor reactions
($1,000–$1,200 expectations, "a little expensive") in the same corpus S4 cites, and
E-D14 shows acceptance declining $1,049→$1,499. S3's framing — CONTESTED, n too small to
conclude either direction — is the board's official position. _(POS-3, F3, PRD-7.)_

**9. The competitor urgency statistic is manufactured — struck; the current competitive
state is real.** "Sentrik expanded from 193 to 632 rules in nine days" (S1) is FALSE as
cited: E-C1 supports two observation timestamps (a 193-rule free tier, unchanged, and a
632-rule total across 26 frameworks with no historical baseline), which cannot
distinguish product velocity from shallow initial recon. The live re-crawled state —
Sentrik's signed-attestation product, Comp AI/Probo traction, AuditKit's Delve-led
homepage, Art. 50 unmoved — stands. _(POS-7, POS-8; critique-claude S1-row-5 FALSE.)_

**10. The product is ahead of its own copy on the named dealbreaker regimes — the
board's strongest cross-corroborated product finding.** The repo ships ISO 27001 and
NIST 800-53 crosswalks (`frameworks-pack/src/crosswalks/`) that hero copy never names,
while 5/12 Study-1 buyers named GDPR/PCI/ISO as their regime (one verbatim dealbreaker)
and copy leads SOC 2/HIPAA. Found independently by T3 (walkthrough) and S4 (repo read);
verified by both critics. _(POS-5, PRD-5; E-D4, E-D7, E-B4.)_

**11. The TECH track's honest verdict is an empty kill list plus one live conflict.**
T4's committed verdict — "Kill: nothing… an empty kill list is this audit's honest
finding, not an evasion" — stands uncontested except for the Python seller plane, where
T1 ("deliberate reckless debt… scale `caisson-docs` + `caisson-support-bot` to zero,
superseding ADR-0009/0096/0105/0206") and T4 ("keep both Python islands, freeze Python
at exactly two"; kill-cost ~7k LOC + eval suite) directly conflict. Both critiques
instruct: preserve both, do not average. It is presented in §3 (D8) as a live operator
decision. _(TEC-6, BIZ-7, DIS-T1, DIS-T4.)_

**12. The proposed 30-day sprint conflates at least four experiments, runs on an
uninstrumented substrate, and has a pass bar with no cost-to-serve condition.** A
discounted-partner close, a Show HN star, an AEO citation, and a cold-email non-response
answer four different questions (F8); there is no send log, no partners-CTA event, no
checkout, no exposure start-date — so zero-based kill criteria punish the product for the
measurement failure (critique-codex). And no seat priced the support/security-response/
auditor-assistance tail of a regulated design partner: "one customer can produce positive
cash and negative solo-founder capacity" (F7). _(F7, F8, PRD-8; E-P1/P2, E-D11.)_

---

## 2. Agree/disagree map — every dissent-ledger row, disposed

No row silently dropped. "Board disposition" = this synthesis's final handling; where a
domain memo already disposed the row, the board adopts unless stated.

### POS rows (memo-positioning.md)

| id     | claim (abbrev.)                                                     | seat(s)             | board disposition                                                                                                                                                          |
| ------ | ------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POS-1  | "Zero executed market contact" / "emails sat unsent"                | S1,S2,S3,T3         | **REJECTED as worded, ADOPTED narrow**: 0 confirmed sends is the fact; inaction is undiagnosed. Feeds D2 and §4-1.                                                         |
| POS-2  | All Study-1 reactions at $1,049; live $1,449 untested               | S1–S4               | **ACCEPTED** — unanimous, unattacked; finding 3. Feeds D4.                                                                                                                 |
| POS-3  | "Only price-credibility signal points upward"                       | S4                  | **REJECTED — struck** (verified cherry-pick, both critiques). S3's CONTESTED framing is the board position.                                                                |
| POS-4  | Third-party proof: "none of it can exist yet"                       | S3                  | **ACCEPTED with narrowing** — testimonials/case studies genuinely absent; a working demo is not customer-contingent; inspectable code is a delivered partial proof (E-B3). |
| POS-5  | Standards-grammar mismatch; ISO 27001/NIST shipped, unnamed         | S3,S4               | **ACCEPTED** — cross-corroborated, verified. Feeds D12.                                                                                                                    |
| POS-6  | "Code-owned compliance is invented — nobody searches it"            | S4                  | **REJECTED as cited / narrower claim adopted**: E-D16 shows no zero-volume finding; the enter-via-incumbent-frame instinct survives on separate grounds.                   |
| POS-7  | "Expanded from 193 to 632 rules in nine days"                       | S1                  | **REJECTED — FALSE, struck** (finding 9). The watch-item stays.                                                                                                            |
| POS-8  | "Sentrik closed most of the gap in nine days" (CORROBORATED)        | S2                  | **TAG REJECTED** — downgrade to OBSERVED-at-two-timepoints/INFERRED; claim unresolved.                                                                                     |
| POS-9  | DIY-agent build the only named substitute; compare surface omits it | S4                  | **PARTIALLY ACCEPTED** — substitute real (n=1, partially usable); `build-in-house` slug exists; Sentrik/Probo genuinely absent. Feeds D12.                                 |
| POS-10 | Wedge "actively validated" / contrarian case "weak"                 | S4,S2               | **UNRESOLVED → recast as testable thesis** (finding 6). Feeds D6.                                                                                                          |
| POS-11 | Champion≈economic-buyer assumption untested                         | (critique-codex)    | **UNRESOLVED — NO-EVIDENCE**; validation task D13.                                                                                                                         |
| POS-12 | Site publicly reachable; pre-launch-zeroes story weakly falsifying  | S2                  | **ACCEPTED, weak** — days-old, directional only.                                                                                                                           |
| POS-13 | Ship Art. 50 correct-the-rumor inside the window                    | S2,S4               | **ACCEPTED with the unpriced risk attached** — Dec-2026 grace-period trap + asymmetric public-error downside named. Feeds D11.                                             |
| POS-14 | Probo "Done for You" drift is evidence-suggested but excluded       | S2                  | **ACCEPTED as a named exclusion** — operator no-go (no services, no liability role); left unexplored on constraint grounds, on the record.                                 |
| POS-15 | "Gates green" licenses immediate contact                            | S2 (S1,S3 implicit) | **REJECTED as scoped** — free-tier-flip receipt only; finding 1. Feeds D1/D2.                                                                                              |

### BIZ rows (memo-business-model.md)

| id    | claim (abbrev.)                                                                                     | seat(s)           | board disposition                                                                                                                                                                                                                                                                                                    |
| ----- | --------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BIZ-1 | "Zero paid partners at day 30 **stops further product spend** and reopens the wedge or pivot board" | S1                | **PRESERVED AS A TRIPWIRE, verbatim** — not "reassess." Attached to D6. Both critiques name this softening as the likeliest laundering failure; it does not occur here. Caveat carried with it: the pass/fail is only interpretable if D7's instrument separation and D15's rail/instrumentation preconditions hold. |
| BIZ-2 | "The cheapest unit of compounding available today is a sent email"                                  | S2                | **PRESERVED** with the POS-1 correction attached: carry the compounding-cost argument, not the unproven diagnosis of why sends are at zero.                                                                                                                                                                          |
| BIZ-3 | "None of us has ever seen the price you are actually charging"                                      | S3                | **PRESERVED in corrected form** — true of the Compliance SKU at $1,449; false as a blanket (two clean $2,059 probes exist, E-D9/E-D10).                                                                                                                                                                              |
| BIZ-4 | "Nobody searches code-owned compliance"                                                             | S4                | **PRESERVED, flagged FALSE-as-cited** — same disposition as POS-6.                                                                                                                                                                                                                                                   |
| BIZ-5 | A signed $869.40 partner will be scored as $1,449 validation                                        | S1/S2/S3 implicit | **REJECTED as stated — the correction is the finding** (finding 5). Feeds D5.                                                                                                                                                                                                                                        |
| BIZ-6 | "Gates green" licenses contact + live demo                                                          | S1,S2,S3          | **REJECTED as stated — scope correction required**; same as POS-15/PRD-10. Feeds D1.                                                                                                                                                                                                                                 |
| BIZ-7 | T4 "kill nothing" vs T1 "seller plane is reckless debt, scale to zero"                              | T4/T1             | **BOTH PRESERVED, unreconciled** — live operator decision, D8.                                                                                                                                                                                                                                                       |

### PRD rows (memo-product-site.md)

| id     | claim (abbrev.)                                              | seat(s)     | board disposition                                                                                                                            |
| ------ | ------------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| PRD-1  | Dead install command rendered "ready"; dead/sandbox checkout | T3          | **ADOPTED, launch-blocking precondition** (verified). Feeds D1.                                                                              |
| PRD-2  | COMPLIANCE-mode/root-key claim false as shipped              | T2          | **ADOPTED, launch-blocking precondition**; tag OBSERVED-by-one-seat (verified by claude-critic), finding not softened. Feeds D1/D10.         |
| PRD-3  | Price footnote implies buyer validation of $1,449            | T3          | **ADOPTED at INFERRED** — the causal step is a craft read. Feeds D12.                                                                        |
| PRD-4  | Month-13/support "unresolved" on site                        | S3          | **STRUCK** — contradicted by deployed source (homepage ~258, plans FAQ 63/205); T3's "answered but three clicks deep" carried instead.       |
| PRD-5  | ISO 27001/NIST shipped, absent from hero copy                | T3+S4       | **ADOPTED** — strongest domain finding. Feeds D12.                                                                                           |
| PRD-6  | "Nothing for the DIY-agent alternative" in compare set       | S4          | **PARTIALLY STRUCK** — `build-in-house` slug exists; Sentrik/Probo absence stands.                                                           |
| PRD-7  | "Only price signal points upward"                            | S4          | **STRUCK** (= POS-3); S3's CONTESTED framing adopted.                                                                                        |
| PRD-8  | Proof "none of it can exist yet"; /partners is bare mailto   | S3/T3       | **CORRECTED, not struck** — inspectable code is partial proof; mailto/no-capture finding stands (zero sends ≠ zero page traffic). Feeds D12. |
| PRD-9  | Homepage clarity budget overspent (4 chooser surfaces)       | T3          | **ADOPTED at INFERRED only** — the #4-respondent citation is inadmissible (unusable respondent); structural observation stands.              |
| PRD-10 | "Gates green" vs T2+T3 launch-blocking collision             | cross-track | **PRESERVED AS A DEPENDENCY** — readiness bar sits _inside_ the contact window. Finding 1; D1/D2.                                            |

### TEC rows (memo-tech-consolidation.md)

| id     | claim (abbrev.)                                        | seat(s) | board disposition                                                                                                                                                 |
| ------ | ------------------------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TEC-1  | WORM COMPLIANCE overclaim vs GOVERNANCE default        | T2      | **PRESERVED VERBATIM, launch-blocking**; tag downgraded to OBSERVED-by-one-seat, finding intact — the board's most consequential single result. D1/D10.           |
| TEC-2  | Ed25519 key via env var in public issuer; KMS unwired  | T2      | **PRESERVED** — env-const verified; KMS-unwired awaits a second source before the launch-vault receipt closes. D10.                                               |
| TEC-3  | RLS proof is PGlite/CI, not Neon/pooler                | T2      | **PRESERVED, single-observer** — launch-blocking proof gap pending receipt. D10.                                                                                  |
| TEC-4  | WORM put inside DB transaction; strandable chain slot  | T2      | **PRESERVED, single-observer** — same status. D10.                                                                                                                |
| TEC-5  | No `expectedMajor`; resolver ignores `claims.major`    | T2      | **PRESERVED** — verified by absence (highest-confidence T2 item); held at T2's own post-launch ranking, not promoted.                                             |
| TEC-6  | Seller plane: T1 scale-to-zero vs T4 keep-frozen       | T1/T4   | **UNRECONCILED, both preserved** — live operator decision D8; no side picked here.                                                                                |
| TEC-7  | `infra/license-issuer` is the ADR-0226 rotation ledger | T4      | **OBSERVED-by-T4** — critics split (claude verified the file directly; codex: E-A5 doesn't support it); likely true, citation defective, held below CORROBORATED. |
| TEC-8  | 328 ADRs/~400KB "force reconstruction" (CORROBORATED)  | T1      | **TAG SPLIT** — counts CORROBORATED; drag claim downgraded to INFERRED.                                                                                           |
| TEC-9  | "7-provider LLM switch"                                | T4      | **CORRECTED to 8** — freeze recommendation unaffected. D9.                                                                                                        |
| TEC-10 | Branch "still absorbing +28k-line slices"              | T4      | **STRUCK as stale** vs binding E-I2 (redesign merged/deployed); apps/site deletion-pressure point survives.                                                       |

### Critic seed rows (critique-claude §3, the 8 DIS-* rows)

| id     | verbatim claim                                                                                                                      | board disposition                                                                                                                                                                                                                                                          |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DIS-S1 | "zero paid partners at day 30 stops further product spend and reopens the wedge or pivot board."                                    | **CARRIED AS A TRIPWIRE** — verbatim, attached to D6. Not softened to "reassess." Its interpretability conditions (D7 instrument separation, D15 rails/instrumentation) are stated alongside, not substituted.                                                             |
| DIS-S2 | "The cheapest unit of compounding available today is a sent email."                                                                 | **CARRIED** with the 0-confirmed-sends correction adjacent (= BIZ-2). Drives D2's urgency.                                                                                                                                                                                 |
| DIS-S3 | "None of us has ever seen the price you are actually charging."                                                                     | **CARRIED in corrected (Compliance-SKU) form** (= BIZ-3). Drives D4's fail-closed posture.                                                                                                                                                                                 |
| DIS-S4 | "'Code-owned compliance' as a standalone category frame is invented — nobody searches it."                                          | **CARRIED as stated position + its rebuttal** (= POS-6/BIZ-4): claim FALSE-as-cited, instinct (enter via the searched incumbent frame) adopted.                                                                                                                            |
| DIS-T1 | "The seller plane is deliberate reckless debt at this stage" — scale docs+support-bot to zero, superseding ADR-0009/0096/0105/0206. | **CARRIED as one horn of D8** — T1 is the only seat that broke the ADR self-insulation spell by naming supersessions; noted that its citation path sits outside the E-id contract.                                                                                         |
| DIS-T2 | Homepage presents COMPLIANCE-mode WORM + leaked-root-key resistance; code defaults GOVERNANCE; live proof never tests COMPLIANCE.   | **CARRIED VERBATIM as a PRECONDITION adjacent to the send-emails decision** (D1→D2). Not a polish item.                                                                                                                                                                    |
| DIS-T3 | "the first command every technical champion runs **fails**" — unpublished package, "ready" chip.                                    | **CARRIED VERBATIM as a PRECONDITION adjacent to the send-emails decision** (D1→D2). Not a polish item.                                                                                                                                                                    |
| DIS-T4 | "**Kill: nothing.** … an empty kill list is this audit's honest finding, not an evasion."                                           | **CARRIED as an explicit finding** (finding 11, D9) — the synthesis invents no consolidation actions. Structural caveat carried with it: T4's deference to 328 agent-authored ADRs is self-insulating; T1's named-supersession move is the counterweight, preserved in D8. |

---

## 3. Decision table

Readiness classes: **READY** (evidence supports acting now) · **EXPERIMENT-FIRST**
(act only as a pre-registered test; no lock) · **NO-EVIDENCE** (corpus is silent —
validation task stub only, no recommendation; fail-closed). The pricing gate is
fail-closed: no row locks a price.

| #   | Decision                                                                                                                                                                                                                                                                  | Options                                                                                                                                                                                            | Board pick + confidence                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Dissent ptr                                                  | E-ids                                                                            | Reversibility                                                                                                     | Readiness                                                    | ADR tag                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| D1  | The three now-public falsifiable claims (dead install line, dead/sandbox pay path, WORM COMPLIANCE overclaim)                                                                                                                                                             | (a) fix this week · (b) restore CF gate instead · (c) defer to launch                                                                                                                              | **(a) Fix this week, before any buyer sees the artifact** — both critiques converge; (b) is the fallback if (a) can't land in days. High.                                                                                                                                                                                                                                                                                                                                | DIS-T2, DIS-T3, PRD-1/2, TEC-1                               | E-B2, E-B3, DEMAND-LEDGER §3                                                     | High (copy/config truth-fixes)                                                                                    | READY                                                        | NEW                                                                         |
| D2  | Send the five drafted design-partner emails                                                                                                                                                                                                                               | (a) send now as-is · (b) send same week, after D1 · (c) hold for full paid-launch receipts                                                                                                         | **(b) Same week as D1, after it** — dependency, not sequencing. DIS-T2/DIS-T3 are the standing preconditions of this row. High.                                                                                                                                                                                                                                                                                                                                          | POS-1, BIZ-6, PRD-10, DIS-S2                                 | DEMAND-LEDGER §§0–1, E-B1                                                        | **Low** — prospect pool is 30/10/5 and slow to replenish; contact-quality burn is one-shot (critique-claude 1b-2) | READY (conditional on D1)                                    | NEW                                                                         |
| D3  | Public exposure posture                                                                                                                                                                                                                                                   | (a) keep site public + fix claims · (b) restore CF-Access gate until install/pay are true · (c) also flip OSS mirror now                                                                           | **(a) if D1 lands in days; else (b)** (T3's bar). OSS flip is D11's separate row. Medium — S2-vs-T3 is a live disagreement (codex #1).                                                                                                                                                                                                                                                                                                                                   | POS-12, POS-15                                               | E-B2 (spot-audit), E-P1                                                          | High                                                                                                              | READY                                                        | NEW                                                                         |
| D4  | Price posture for Compliance at $1,449                                                                                                                                                                                                                                    | (a) lock $1,449 · (b) raise · (c) lower · (d) no lock; run a clean n≥5 real-ICP reaction round at the live anchor                                                                                  | **(d) — fail-closed gate binding; no lock in any direction.** Direction is CONTESTED by sample (S3's framing adopted; S4's struck). High on the no-lock; none on direction.                                                                                                                                                                                                                                                                                              | POS-2/3, BIZ-3, PRD-7, DIS-S3                                | E-D1, E-D9, E-D10, E-D14, spot-audit §D                                          | High (a test, not a commitment)                                                                                   | EXPERIMENT-FIRST                                             | CONFIRMS-ADR-0373 (operative displayed price; explicitly NOT WTP-validated) |
| D5  | What a signed discounted partner counts as                                                                                                                                                                                                                                | (a) $1,449 list-price validation · (b) $869.40 relationship + proof/case-study purchase, labeled as such                                                                                           | **(b)** — a discounted close validates the discount, full stop. High.                                                                                                                                                                                                                                                                                                                                                                                                    | BIZ-5, F4                                                    | ADR-0297 terms, E-D21                                                            | n/a (labeling rule)                                                                                               | READY                                                        | CONFIRMS-ADR-0297 (terms stand; what they measure is relabeled)             |
| D6  | Compliance wedge: pivot / persevere                                                                                                                                                                                                                                       | (a) persevere as validated · (b) persevere as **testable thesis** with S2's pre-registered vectors (V1 OSS-unbundle default fallback, V3 regime reframe) + DIS-S1 tripwire · (c) pivot now         | **(b). TRIPWIRE VERBATIM: "zero paid partners at day 30 stops further product spend and reopens the wedge or pivot board."** Not "reassess." No seat or critique supports (c) today. Medium.                                                                                                                                                                                                                                                                             | POS-10, BIZ-1/DIS-S1, POS-14 (services drift stays excluded) | E-D16, E-B5, E-D1, E-D3, E-C2                                                    | Medium — 30-day tripwire bounds the bet                                                                           | EXPERIMENT-FIRST                                             | CONFIRMS-ADR-0040 **as hypothesis** (not validation)                        |
| D7  | 30-day instrument design                                                                                                                                                                                                                                                  | (a) one mixed "market contact" sprint · (b) four separated pre-registered instruments: buyer-map interviews / list-price reactions / discounted-partner conversion / public developer distribution | **(b)** — the mixed sprint cannot attribute a null result (F8). Success criteria disjoint per instrument. High.                                                                                                                                                                                                                                                                                                                                                          | F8; codex constraint 5                                       | DEMAND-LEDGER, E-P1/P2, E-D8/D9                                                  | High                                                                                                              | READY                                                        | NEW                                                                         |
| D8  | Python seller plane (`caisson-docs`, `caisson-support-bot`)                                                                                                                                                                                                               | (a) T1: scale to zero, **superseding ADR-0009/0096/0105/0206 by name** (llms.txt + health-safe unavailable state preserved) · (b) T4: keep both, freeze Python at exactly two islands              | **NO BOARD PICK — live operator decision; the T1-vs-T4 split is real dissent, preserved unaveraged.** T1's horn is the only one that names its ADR supersessions; T4's kill-cost is ~7k LOC + eval suite. Split.                                                                                                                                                                                                                                                         | TEC-6, BIZ-7, DIS-T1, DIS-T4                                 | E-A4, E-P1/P2; ADR-0009/0096/0105/0206 (verified present, outside E-id contract) | (a) reversible per T1; (b) status quo                                                                             | READY (either horn executable; the choice is the operator's) | (a) CONTRADICTS-ADR-0009/0096/0105/0206 · (b) CONFIRMS same                 |
| D9  | All other consolidation candidates                                                                                                                                                                                                                                        | (a) adopt T4's committed list: kill nothing, merge nothing; freeze LLM adapters at 8, `agent-*` at 6 · (b) invent consolidation actions anyway                                                     | **(a) — the empty kill list is the finding, not an evasion** (DIS-T4). Provider count corrected 7→8 (TEC-9). High.                                                                                                                                                                                                                                                                                                                                                       | DIS-T4, TEC-7/9/10                                           | E-A1/A3/A9/A10, ADR-0226/0257/0057/0094/0097                                     | High                                                                                                              | READY                                                        | CONFIRMS-ADR-0257, -0226, -0057, -0094, -0097, -0088                        |
| D10 | Paid-launch gate: T2's four security/proof receipts (COMPLIANCE-mode WORM proof, deployed-pooler RLS attestation, split-brain recovery proof, KMS-backed signing)                                                                                                         | (a) hold paid gate on executable receipts · (b) launch on code inspection alone                                                                                                                    | **(a)** — and promote T2's file:line reads into auditable evidence items with repro steps (both critics: tags currently overstate the E-id chain; TEC-3/4 are single-observer). High on holding; receipts 3–4 need second-source verification.                                                                                                                                                                                                                           | TEC-1..5, PRD-2                                              | T2 file:line reads; E-A4/A9 (context only)                                       | n/a (proof work)                                                                                                  | READY                                                        | NEW                                                                         |
| D11 | EU AI Act Art. 50 correct-the-rumor content (window closes 2026-08-02)                                                                                                                                                                                                    | (a) ship fast inside the window · (b) ship only with the Dec-2026 Art. 50(2) grace-period nuance handled + a verification pass · (c) skip                                                          | **(b)** — the hook is real and dated; the unpriced downside (a trust-market vendor publicly wrong about the regulation it centers copy on) is now priced into the pick. Low-medium.                                                                                                                                                                                                                                                                                      | POS-13                                                       | E-C6, spot-audit §C                                                              | **Low** — a public regulatory error is not retractable cheaply                                                    | EXPERIMENT-FIRST                                             | NEW                                                                         |
| D12 | Message-match copy fixes: name ISO 27001 (+NIST 800-53) at hero level; surface month-13 answer at the decision point; defuse the price-footnote implied-validation read; instrument `/partners` (form or tracked click, not bare mailto); add Sentrik/Probo compare pages | (a) do all now (days of copy work, no new research) · (b) defer                                                                                                                                    | **(a)** — items 4–6 of the product-site launch list; none requires new evidence. High.                                                                                                                                                                                                                                                                                                                                                                                   | POS-5/9, PRD-3/4/5/6/8                                       | E-D4, E-D7, E-B4, E-D10, E-D5                                                    | High                                                                                                              | READY                                                        | CONFIRMS-ADR-0080 (copy law applied, not changed)                           |
| D13 | Buyer-map validity: is the technical champion close enough to the compliance-budget owner for self-serve one-time purchase?                                                                                                                                               | —                                                                                                                                                                                                  | **NO RECOMMENDATION — corpus is silent.** _Validation task: 3–5 interviews with economic buyers/procurement owners at regulated-SaaS companies (not panel respondents), asking who owns compliance budget, whether owned source code is procurable self-serve, and what their auditor accepts. Run as D7's first instrument._                                                                                                                                            | POS-11, F6                                                   | E-D5, E-D7, E-D10, E-D11, E-B5 (all establish the gap, none close it)            | n/a                                                                                                               | NO-EVIDENCE                                                  | NEW                                                                         |
| D14 | Auditor acceptance of the WORM-chain evidence pack in place of a Vanta-style report                                                                                                                                                                                       | —                                                                                                                                                                                                  | **NO RECOMMENDATION — zero evidence anywhere in the corpus; the thesis's single point of failure has no seat.** _Validation task: put the artifact in front of 2–3 working auditors; record accept/reject and conditions. Cheap, decisive, currently absent._                                                                                                                                                                                                            | critique-claude 1c; PRD-8/POS-4 (proof gap)                  | E-D5 (proof objection), E-B3                                                     | n/a                                                                                                               | NO-EVIDENCE                                                  | NEW                                                                         |
| D15 | Preconditions for any 30-day pass/fail revenue criterion: payment rails + instrumentation + cost-to-serve bar                                                                                                                                                             | —                                                                                                                                                                                                  | **NO RECOMMENDATION on timing — the board holds no knowledge of Mercury/Paddle timelines (zero seats).** _Validation tasks: (1) date the Mercury/Paddle gates or establish Paddle-as-MoR needs no Mercury-first; (2) wire send-log, /partners event, checkout, exposure-date instrumentation before kill criteria arm; (3) price the support/security-response/auditor-assistance tail and attach a support-boundary condition before "one paid partner" is a pass bar._ | F7, F8; codex constraints 7 & 10; DIS-S1 (interpretability)  | DEMAND-LEDGER §0, E-P1/P2, E-D11, E-D21                                          | n/a                                                                                                               | NO-EVIDENCE                                                  | NEW                                                                         |

---

## 4. The uncomfortable truths (carried unlaundered)

The critics flagged these as the items most likely to be softened out of a synthesis.
They are reproduced verbatim, with no reframing.

**1. The eleven-day question.** critique-claude 1b-4: _"The pack's central mystery — five
send-ready emails held since 2026-07-12 while nothing gated an email — is diagnosed by no
seat. Every recommendation implicitly assumes the bottleneck was the absence of a board
memo. If the 11-day hold is revealed preference (avoidance, perfectionism,
optics-anxiety — the ledger's own 'business optics' phrase), then the board just produced
eight more reasons to keep preparing. Nobody asked_ why _the emails weren't sent, which is
the one question a real board would open with."_ And its bottom line: _"diagnose, out
loud, why they weren't sent eleven days ago."_ Codex's counterweight stands adjacent, not
in place of it: the ledger proves 0 _confirmed_ sends — the diagnosis of avoidance is
unproven; the question still must be asked and answered by the operator, out loud.

**2. The mirror.** critique-claude 1d-3: _"OPERATOR-CONSTRAINTS records observed session
spend up to ~$800/day on heavy agent waves. This board — eight engines, an evidence pack,
a spot audit, this critique — is the exact substitution-of-research-for-contact pattern
S1 and S2 attack. No seat named the mirror."_ This report is part of the pattern it
documents. The only exit it can offer is D1→D2 executed this week.

**3. The missing acceptance evidence.** critique-claude 1c: _"The entire product thesis
terminates in S4's own value claim: 'your auditor verifies without trusting any vendor.'
No seat represents the person who accepts or rejects evidence packs. Zero evidence
anywhere in the corpus that any working auditor will accept a WORM-chain artifact in
place of a Vanta-style report — and no memo names this as the thesis's single point of
failure."_ (D14 is the stub; it carries no recommendation because there is nothing to
recommend from.)

**4. Eight work programs, one person.** critique-claude 1c: _"Summed, the eight memos
demand: a 30-day outreach sprint (S1), an OSS flip + Show HN + Art. 50 content (S2), a
new ≥5-interview research round + two copy programs (S3), a comparison-page and copy
program (S4), an architecture freeze superseding four ADRs (T1), four security receipt
programs (T2), a three-item site readiness bar + homepage re-cut (T3). Nobody totaled the
combined ask against one person's month. The board issued eight partially-conflicting
work programs and no priority order."_ The decision table above is a priority order —
D1→D2 is the only this-week pair; D8 is the one decision only the operator can make;
D13–D15 are stubs, not work — but the total remains more than one person's month, and
choosing what _not_ to do from this table is itself an operator decision no seat made.

**5. Success may be more dangerous than failure.** critique-codex: _"The first customer
buys an unlimited-personnel, perpetual code artifact at $869.40 while the research says
support ambiguity is a major objection… One customer can therefore produce positive cash
and negative solo-founder capacity. The board's 'one paid partner' pass bar has no
cost-to-serve or support-boundary condition."_ (Bound into D15 before DIS-S1's tripwire
can arm.)

---

_Struck and staying struck: the 193→632 "nine-day" statistic (POS-7, FALSE per E-C1) and
"the only price-credibility signal on record points upward" (POS-3/PRD-7, verified
cherry-pick). Neither appears above as evidence, only as a struck record._

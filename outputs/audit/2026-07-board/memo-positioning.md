# Phase-3 Domain Synthesis — Positioning + Market

Domain: category frame, competitive positioning, wedge integrity, pricing-as-market-signal,
buyer voice, demand state. Synthesized from S1–S4 (Phase 1), critique-claude.md +
critique-codex.md (Phase 2). No claim below is introduced beyond what a memo, critique, or
E-id in the pack states; every row traces to at least one of those three sources.
Binding corrections honored throughout: ADR-0373 ($1,449) supersedes ADR-0304's $1,049
anchor; the CF-Access gate is no longer observably up; ADR count is 328; sufficiency gate
(E-P1/E-P2) holds all funnel/CAC/conversion claims ASSUMED.

---

## Ranked findings

**1. Zero _confirmed_ market contact — not zero market contact.** The demand ledger records
30 candidates researched, 10 shortlisted, 5 design-partner emails drafted since 2026-07-12,
and 0 confirmed sends, replies, or signed partners (DEMAND-LEDGER §1). S1, S2, S3, and T3 all
render this as "sat unsent" / "none has even been contacted" / "zero executed field contact."
**CORROBORATED (the zeroes) / REJECTED (the causal wording)** — critique-codex: the ledger is
"a git record, not the founder's email outbox, CRM, calendar, or memory"; an absent log entry
proves deficient instrumentation, not deficient activity. The corrected claim: the corpus
contains **no evidence of send, reply, or signed partner** — which still fully supports every
seat's "go make contact" recommendation, but not the stronger diagnosis (avoidance,
perfectionism) several seats layer on top of it. _Sources: S1 §1, S2 §5.1, S3 §5, T1 rec;
critique-claude 1b-4, critique-codex 1-1._

**2. Every WTP reaction in the corpus was gathered at a price that no longer exists.**
Compliance's live price is $1,449 (ADR-0373, 2026-07-20); every Study-1 reaction (n=10 of 12)
was to $1,049, 38% lower; Study 2 never tested $1,449 either. **CORROBORATED — binding
spot-audit §D correction**, independently reasserted by all four strategy seats (S1 §3, S2 §5.3,
S3 §1, S4 §4). This is the single most over-determined finding in the domain and the one no
critique attacks. _E-ids: E-D1, E-D15, EVIDENCE-spot-audit §D._

**3. The price-credibility _direction_ is contested, not one-way.** S4 claims "the only
price-credibility signal on record points upward, not down" (citing #12's "lowball" read and
#1's "surprisingly cheap"). **REJECTED as stated** — both critiques independently catch the
same omission: E-D10 (which S4 itself cites elsewhere) records two of four Study-2 reactions
anchoring _below_ the price ($1,000–$1,200 expectation, "a little expensive"), and E-D14 shows
acceptance _declining_ from $1,049 to $1,499. S3's framing — "CONTESTED by sample: n is too
small to conclude either direction" — is the version that survives and should replace S4's in
any synthesis. _E-ids: E-D1, E-D10, E-D14; S3 §5, S4 §4; critique-claude S4-row-3,
critique-codex S4-row-4._

**4. Third-party proof is the #1 named blocker — but "none of it can exist yet" overstates
the gap.** S3: testimonials/case studies/working demo is the highest-frequency objection
across the whole program, and the demand ledger confirms zero customers, zero design
partners, zero public repo. **CORROBORATED (the objection) / STRETCHED (the "none of it can
exist" absolute)** — critique-codex: a working demo is not logically contingent on an existing
customer; the genuinely-unbuildable artifacts are testimonials and regulated-vertical case
studies specifically. T3 independently corroborates the site's honest partial answer ("no logo
wall yet — here's what you can check instead") but critique-claude flags T3's "message-match is
mostly genuinely good" verdict as laundering the fact that the proof engine (`/partners`) has
converted nobody. _E-ids: E-D5, E-B3, DEMAND-LEDGER §§1,7; S3 §2; critique-codex S3-row-2,
critique-claude 1d._

**5. Standards-grammar mismatch is real and only partially fixed.** Five of twelve Study-1
interviewees named GDPR/PCI DSS/ISO 27001 as their actual regime (none led with HIPAA); #7
made GDPR/PCI DSS an explicit verbatim dealbreaker; the federal buyer (#1, n=1, self-flagged
thin) reads SOC 2/GDPR as wrong-audience overreach and wants FedRAMP/NIST 800-53/FISMA. The
shipped redesign added a "PCI DSS · GDPR crosswalks" chip to the hero door, but the repo
already ships ISO 27001 + NIST 800-53 crosswalks (`packages/frameworks-pack/src/crosswalks/`)
that the door copy names nowhere. **CORROBORATED** — independently verified in this session's
source reads by both critics; S3 and S4 converge on it without contradiction, a rare clean
agreement. _E-ids: E-D4, E-D7, E-B4; S3 §3, S4 point 2; critique-claude S4-row-2 ENTAILED._

**6. "Code-owned compliance" as an invented standalone category is a claim the evidence
does not fully support.** S4: "nobody searches it" (E-D16, E-B gaps #3). **REJECTED as
stated** — critique-codex: E-D16 shows compliance keywords are expensive and the SERP is owned
by finished platforms; it does not report a query or a zero-volume finding for "code-owned
compliance" or "dev-kit" specifically. The narrower, defensible claim survives: there is no
demand-reference pool for the owned-code/dev-kit sub-frame, so entry should be through the
already-searched incumbent-alternative frame ("compliance automation software," $212 CPC/KD
10), not a coined category name. _E-ids: E-D16, E-B gaps #3, E-B5/B6; S4 point 3; critique-codex
S4-row-3._

**7. Competitive window is closing at an unverifiable rate.** Four entrants moved: Sentrik
(early-access → 632-rule, 26-framework, signed-attestation product), Comp AI + Probo (out-
traction the prior #1 threat ~3 orders of magnitude in GitHub stars), AuditKit (now leads its
own homepage with the Delve scandal Caisson uses mid-page). **CORROBORATED (current state,
live re-crawl) / REJECTED (the growth-rate framing)** — S1's "expanded from 193 to 632 rules in
nine days" is **FALSE**: E-C1 supports two observation timestamps (193-rule free tier, unchanged,
vs. a 632-rule _total_-across-26-frameworks figure with no historical baseline), not a measured
delta, and cannot distinguish product velocity from a shallow initial recon. S2's "closed most
of the gap in nine days" inherits the same defect and should be downgraded from CORROBORATED to
OBSERVED-at-two-timepoints/INFERRED. _E-ids: E-C1, E-C2, E-C3; S1 §5, S2 §2, S4 point 5;
critique-claude 1b-3 and S1-row-5 FALSE, critique-codex fracture note._

**8. The named alternative buyers actually compare against is a DIY agent build, not a
competitor SKU — but the site's own comparison program already has a slug for it.** One
partially-usable Study-2 respondent (#3) compared the $2,059 Everything price against "Codex/
Claude on my $100 plan." S4 elevates this to "the only substitute a real buyer named" and
claims the site's comparison surface omits it entirely. **OBSERVED (the substitute, n=1,
partially usable) / PARTIAL (the omission claim)** — the snapshot ships 21 `/compare/*` pages
including a `build-in-house` slug (contra S4's "nothing for the DIY-agent alternative");
Sentrik and Probo are genuinely absent from the comparison set. _E-ids: E-D10, E-D3; S4 point 1
and 4; critique-claude S4-row-4 PARTIAL._

**9. The compliance wedge itself was spared the adversarial standard applied to everything
else in the pack.** Every supporting citation for "the hero frame is right" is a proxy: E-D16
is desk-research keyword economics explicitly labeled WEAK and explicitly not evidence of
Caisson conversion; E-B5 is an inferred complaint synthesis about GRC-SaaS buyers, not evidence
they will buy a source-code product; E-D1 is ten reactions to a retired price from an
"ICP-adjacent" cohort with acknowledged off-fit participants; E-D3's survey panel was 68%
"Other." **UNRESOLVED — the domain's sharpest finding, raised only by critique-codex.** S2's
own contrarian inversion concedes "the contrarian case against the compliance wedge itself is
weak" and S4 calls the hero "one of the few actively validated decisions" — neither claim
survives the evidence tiers both seats cite themselves. The pack supports a **compliance
hypothesis worth testing**, not "the wedge is right." _E-ids: E-D16, E-B5, E-D1, E-D3;
critique-codex §1-checklist-2 and Verdict._

**10. The load-bearing commercial assumption under the entire positioning thesis has never
been named, let alone tested, by any strategy seat.** The thesis requires that the technical
champion who values fail-closed RLS, WORM evidence, and owned source is close enough to the
person who controls a compliance budget that a self-serve, one-time code purchase can close
without a services or procurement layer. **UNRESOLVED — no seat proposes a direct test.**
E-D5 separates technical inspection from the economic buyer's proof needs; E-D11 says ownership
does not imply self-sufficiency; E-D10 shows the closest thing to a real substitute is a DIY
agent build a technical champion reaches for alone. None of this establishes the champion
controls a budget, or that the economic buyer wants owned code at all — the corpus is silent on
whether the missing ingredient is proof/outreach (the board's shared assumption) or a broken
buyer map (champion ≠ economic buyer, a possibility no seat tested). _E-ids: E-D5, E-D7, E-D10,
E-D11, E-B5, DEMAND-LEDGER; critique-codex "Which shared assumption is unvalidated."_

**11. The site is now publicly reachable, and the "zeroes are purely pre-launch" story is
weakly beginning to falsify itself.** The CF-Access gate is no longer observably up (two
independent crawls reached the marketing site from the open internet); 30-day traffic remains
one visitor. **OBSERVED, weak, days-old** — properly hedged by S2 itself and left standing by
both critiques as a directional-only signal, not a demand conclusion. _E-ids: E-B2 (spot-audit
correction), E-P1; S2 §5.4._

**12. The EU AI Act Article 50 hook is real, dated, and carries an unpriced downside.**
Obligations apply 2026-08-02 (confirmed unmoved, EC guidelines published 2026-07-20); a
"delayed to 2027" rumor is live and debunkable, giving Caisson a sharper correct-the-rumor hook
than the deadline alone. **CORROBORATED (dates) / a named risk left unpriced** — critique-claude:
three memos push a rushed regulatory-commentary piece inside ten days and the spot-audit itself
flags a Dec-2026 grace-period nuance for one marking obligation as a trap; no seat weighs the
asymmetric reputational cost of a trust-market vendor being wrong in public about the regulation
it is centering copy on. _E-ids: E-C6, spot-audit §Section-C; S2 vector V3, S4 point 5;
critique-claude 1d-4._

---

## Agree / disagree map

**Where the domain agrees (and where that agreement is itself suspect):**

- All four strategy seats agree the live $1,449 price has zero buyer evidence (finding 2) —
  the domain's one clean, adversarially-surviving consensus.
- S3 and S4 agree on the standards-grammar mismatch and its partial fix (finding 5) — the
  second clean agreement, independently re-verified by both critics.
- S2 and S4 agree the compliance hero frame should not be re-litigated this cycle — but
  critique-codex names this convergence itself as the domain's most dangerous failure: every
  seat that could have adversarially tested the wedge declined to (finding 9).
- S1, S2, S3 (and T1, outside this domain) converge near-verbatim on "send the five drafted
  emails" — real, but critique-claude traces the convergence to the demand ledger's own
  editorializing ("the single most-developed GTM motion... still reads as zero executed field
  contact") rather than four independent seats reasoning it out separately.

**Where the domain disagrees, unresolved:**

- **Category strategy.** S4 commits to keeping ADR-0040's hero and repositioning explicitly
  against the GRC-subscription class plus the DIY-agent build. S2 offers three _pre-registered_
  pivot vectors (unbundle-OSS-first, re-wedge to AI-spend-governance, regime pivot to
  GDPR/PCI/ISO/EU-AI-Act) while explicitly declining to argue against the wedge itself. Neither
  position is a rejection of the other's frame, but they propose different next moves on the
  same 30-day clock, and no synthesis has reconciled the sequencing.
- **The only-named substitute.** S4 treats the DIY-agent build as _the_ alternative to defeat
  on-page. Critique-codex holds this open: the corpus (n=1, partially usable) cannot rule out
  that the real competing option is "a compliance consultant/auditor relationship" or "nothing
  — we defer this until forced" (a possibility S4's own memo names as the condition that would
  change its mind).
- **Price-credibility direction.** S4 says the only signal points upward; S3 (and both
  critiques) say the sample is too small to conclude either direction. This is a direct
  contradiction inside the same evidence base (E-D10) and must not be averaged into a single
  synthesis sentence.
- **What "gates green" licenses.** S2 explicitly cites "all technical go-live gates are green"
  (DEMAND-LEDGER §0) as license to flip the OSS mirror and pursue immediate market contact. Both
  critiques note this receipt is scoped to the free-tier flip only, and is silently contradicted
  by findings outside this domain (the tech track's launch-blocking claims) that neither track
  cross-read. This domain cannot resolve the contradiction — it can only flag that any
  market-facing recommendation here (finding 1, 11) inherits it as an unverified precondition,
  not a settled green light.

---

## Minority Report

Verbatim, unresolved dissents, preserved against synthesis averaging.

> **S3, on price:** "None of us has ever seen the price you are actually charging."
> — This is the buyer-voice seat's flattest rejection of any market-contact plan that treats
> $1,449 as pre-validated. It stands in direct, unresolved tension with S4's positioning claim
> that the price-credibility signal favors holding or raising (finding 3).

> **S4, on category:** "'Code-owned compliance' as a standalone category frame is invented —
> nobody searches it."
> — Preserved as S4's stated position even though critique-codex rejects its evidentiary basis
> (finding 6): the underlying instinct — don't invent a category name, enter through the
> incumbent-alternative search frame — may be right for reasons E-D16 doesn't itself prove.
> The claim and its rebuttal are both live in the record; a synthesis should not silently pick
> one without naming the dispute.

> **S2, refusing to argue a vector it flags as evidence-suggested:** "The Probo-drift direction
> — 'Compliance, Done for You,' a managed-service layer (E-C2) — is the one evidence-suggested
> vector I refuse to argue: it requires services delivery and edges toward compliance-officer-
> of-record liability, both explicit operator exclusions... Any seat proposing it should be
> asked which of those two constraints they intend to break."
> — An intentional, self-imposed minority position: real market evidence points toward a
> services-layer wedge, and the domain's own contrarian seat declines to chase it on operator-
> constraint grounds, not evidentiary grounds. This is a live tension between "what the market
> shows" and "what the operator will build," never reconciled by any other seat.

> **critique-codex, dissenting from the whole board's positioning consensus:** "The board's
> gravest defect is not excessive pessimism. It is premature convergence... Nothing in the pack
> demonstrates that buyer-and-authority combination [that the technical champion is close
> enough to the economic buyer to self-serve a one-time purchase]."
> — The single sharpest minority position in the domain (finding 10), issued by neither S-seat
> nor T-seat but by the Phase-2 critic itself, and not answered by any memo because no memo
> anticipated the question.

> **S3, on the substitute claim's own contested reading:** "CONTESTED by sample: n is too small
> to conclude either direction" [re: whether buyers want the price cheaper].
> — S3's own honesty marker, offered as the correct form of a claim S4 states as settled
> (finding 3). Preserve S3's hedge verbatim rather than S4's directional version.

---

## Dissent Ledger rows

| id     | claim                                                                                                                                                              | evidence                                | seat                                          | disposition                                                                                                                                                                                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POS-1  | "Zero executed market contact" / "five emails sat unsent" / "none has even been contacted"                                                                         | DEMAND-LEDGER §1                        | S1, S2, S3, T3                                | **rejected as worded** — the ledger proves 0 confirmed sends (a recordkeeping absence), not that no send occurred (critique-codex 1-1); the narrower claim stands and still supports the "make contact" recommendation                                     |
| POS-2  | Every Study-1 price reaction was gathered at $1,049; live $1,449 is untested                                                                                       | E-D1, E-D15, spot-audit §D              | S1, S2, S3, S4                                | **accepted** — binding spot-audit correction, unattacked by either critique, the domain's cleanest finding                                                                                                                                                 |
| POS-3  | "The only price-credibility signal on record points upward, not down"                                                                                              | E-D1, E-D14, E-D17                      | S4                                            | **rejected** — E-D10 (S4's own cite elsewhere) records two below-anchor reactions in the same corpus; both critiques independently catch the cherry-pick                                                                                                   |
| POS-4  | "Third-party proof... none of it can exist yet"                                                                                                                    | E-D5, DEMAND-LEDGER §§1,7, E-B3         | S3                                            | **accepted with narrowing** — a working demo isn't logically contingent on a customer (critique-codex); the genuinely-absent artifacts are testimonials/case studies specifically                                                                          |
| POS-5  | Standards-grammar mismatch (GDPR/PCI/ISO named vs. SOC 2/HIPAA-led copy; ISO 27001 shipped but unnamed at hero level)                                              | E-D4, E-D7, E-B4 + repo crosswalk files | S3, S4                                        | **accepted** — independently re-verified by both critics against the pinned snapshot; n=1 federal caveat honored by both seats                                                                                                                             |
| POS-6  | "'Code-owned compliance' as a standalone category frame is invented — nobody searches it"                                                                          | E-D16, E-B gaps #3                      | S4                                            | **rejected as stated / narrower claim unresolved** — E-D16 shows expensive, platform-owned SERP, not a zero-search finding for the specific frame; the "enter via the incumbent-alternative frame" instinct survives on separate grounds                   |
| POS-7  | "The closest direct competitor expanded from 193 to 632 rules in nine days"                                                                                        | E-C1                                    | S1                                            | **rejected — FALSE** — E-C1 supports two observation timestamps only; 193 is an unchanged free-tier figure, 632 is a total with no historical baseline; the statistic is manufactured                                                                      |
| POS-8  | "Sentrik closed most of the surface gap in nine days" (tagged CORROBORATED)                                                                                        | E-C1                                    | S2                                            | **rejected tag, claim unresolved** — should read OBSERVED-at-two-timepoints/INFERRED; cannot distinguish product velocity from a shallow initial recon                                                                                                     |
| POS-9  | "The only substitute a real buyer named is the $100/mo DIY agent build; the site's comparison surface omits it entirely"                                           | E-D10, E-D3, E-B2                       | S4                                            | **partially accepted** — the substitute is real (n=1, partially usable); the "omits it entirely" claim is contradicted by the snapshot's existing `build-in-house` compare slug                                                                            |
| POS-10 | The compliance wedge (ADR-0040) is "one of the few actively validated decisions" / the contrarian case against it "is weak"                                        | E-D16, E-B5, E-D1, E-D3                 | S4, S2                                        | **unresolved** — critique-codex: every supporting citation is a proxy (desk keywords, inferred complaint synthesis, a retired price point, a 68%-off-ICP panel); the wedge itself was never adversarially tested the way every other claim in the pack was |
| POS-11 | The load-bearing assumption — a technical champion who wants owned compliance code is close enough to the economic budget-holder to self-serve a one-time purchase | E-D5, E-D7, E-D10, E-D11, E-B5          | none of S1–S4 (raised only by critique-codex) | **unresolved** — no seat names or proposes a direct test of this assumption; it underlies every recommendation in the domain                                                                                                                               |
| POS-12 | The site is publicly reachable now; 30-day traffic is beginning to falsify the "pre-launch zeroes" reading                                                         | E-B2 (spot-audit correction), E-P1      | S2                                            | **accepted, weakly** — properly hedged by S2 as a weak, days-old, directional-only signal; left standing by both critiques                                                                                                                                 |
| POS-13 | The EU Art. 50 correct-the-rumor content hook should ship inside the ~10-day window before 2026-08-02                                                              | E-C6, spot-audit                        | S2, S4                                        | **accepted, with an unpriced risk named** — the hook and dates are real; critique-claude flags that no seat priced the asymmetric downside of a rushed, wrong regulatory-commentary piece from a trust-market vendor                                       |
| POS-14 | The Probo "Compliance, Done for You" managed-service drift is an evidence-suggested pivot vector                                                                   | E-C2                                    | S2 (attacked, not proposed)                   | **accepted as a named exclusion** — consistent with OPERATOR-CONSTRAINTS' no-services/no-regulated-liability no-go zones; S2 itself declines to argue it, leaving real market evidence unexplored on constraint grounds alone                              |
| POS-15 | "All technical go-live gates are green" licenses immediate buyer contact and public traffic                                                                        | DEMAND-LEDGER §0                        | S2 (endorsed); S1, S3 (relied on implicitly)  | **rejected as scoped** — both critiques: the receipt covers the free-tier flip only; any market-contact recommendation in this domain inherits an unverified precondition from outside the domain, not a settled green light                               |

---

**What this domain does not resolve.** Whether the compliance wedge survives adversarial
testing (finding 9), whether the champion/economic-buyer gap is real (finding 10), and which of
S2's three pivot vectors should sequence first if the 30-day contact window returns silence —
none of these are decidable from the positioning/market evidence alone. They are the domain's
open kill-criteria, not settled findings, and no synthesis should present them as closed.

---
title: "CAISSON-150 board fork re-walk preparation"
updated: 2026-07-25
status: live
issue: CAISSON-150
grounds:
  - outputs/audit/2026-07-board/BOARD-REPORT.md
  - outputs/audit/2026-07-board/OPERATOR-CONSTRAINTS.md
  - outputs/audit/2026-07-board/DEMAND-LEDGER.md
  - outputs/audit/2026-07-board/EVIDENCE.md
  - outputs/audit/2026-07-board/EVIDENCE-competitors.md
  - outputs/audit/2026-07-board/EVIDENCE-firstparty.md
  - outputs/audit/2026-07-board/EVIDENCE-market-voice.md
  - outputs/audit/2026-07-board/EVIDENCE-product-data.md
  - outputs/audit/2026-07-board/EVIDENCE-repo.md
  - outputs/audit/2026-07-board/EVIDENCE-spot-audit.md
  - outputs/audit/2026-07-board/memo-business-model.md
  - outputs/audit/2026-07-board/memo-positioning.md
  - outputs/audit/2026-07-board/memo-product-site.md
  - outputs/audit/2026-07-board/memo-tech-consolidation.md
  - docs/state/decisions-and-forks.md
  - docs/state/outstanding-work.md
  - docs/adr-index.md
  - docs/deploy/STATE.md
  - docs/ops/launch-runbook.md
  - knowledge/decisions/ADR-0379-full-state-completion-program-locks.md
  - knowledge/decisions/ADR-0380-five-product-residuals.md
  - knowledge/decisions/ADR-0381-launch-gate-and-canonical-control.md
  - knowledge/decisions/ADR-0382-revenue-recognition-signing-and-oscal-direction.md
  - knowledge/decisions/ADR-0383-oscal-spine-sku-and-compliance-reprice.md
  - knowledge/decisions/ADR-0384-oscal-full-surface-carve-and-renewal.md
  - knowledge/decisions/ADR-0385-evidence-pack-boundary-and-export-allowlist.md
  - knowledge/decisions/ADR-0386-everything-reprice-and-two-release-sequence.md
  - knowledge/decisions/ADR-0387-azure-kms-backs-field-crypto.md
  - https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems
  - https://digital-strategy.ec.europa.eu/en/factpages/quick-facts-transparency-rules-ai-systems
  - https://eur-lex.europa.eu/eli/reg/2024/1689/oj?locale=en
---

# CAISSON-150 board fork re-walk preparation

> **D11 DEADLINE: 2026-08-02 — EIGHT CALENDAR DAYS FROM THIS RE-WALK.**
>
> Article 50 obligations begin to apply on August 2; that date is a legal applicability date,
> **not a legal deadline for Caisson to publish an article**. The content opportunity is
> time-sensitive because the Commission published final guidance on July 20. To use the hook,
> choose D11 now, complete a factual/legal verification pass, and publish by August 1.

## Re-walk contract

This is a fresh disposition of D1-D15 against the repository and external ground truth on
2026-07-25. The prior board picks are evidence, not defaults, and have been discarded as choices.
This document does not lock a fork, change an ADR, update the live fork board, or authorize product
work.

Statuses have strict meanings:

- **ANSWERED** — a later lock or completed act already determines the outcome. Do not re-decide it.
- **SUPERSEDED** — later facts invalidate the old question or its options. Record the replacement
  question, but do not choose it here.
- **OPEN** — the operator still has a real choice. Only these rows carry options and a recommendation.

The current count is **6 ANSWERED / 3 SUPERSEDED / 6 OPEN**.

## Status index

| ID  | Status     | Re-walk disposition                                                                                              |
| --- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| D1  | ANSWERED   | PR #327 and the public/commerce split removed the three falsifiable public states.                               |
| D2  | ANSWERED   | Five emails wait for the four technical receipts; the old same-week send is closed.                              |
| D3  | ANSWERED   | Public marketing stays up; commerce stays gated; OSS/npm wait for business and release gates.                    |
| D4  | SUPERSEDED | ADR-0383/0386 locked $1,649 Compliance and $2,259 Everything; implementation is still pending.                   |
| D5  | OPEN       | Decide what a 40%-off partner purchase is allowed to validate.                                                   |
| D6  | OPEN       | Decide whether the compliance wedge remains a bounded thesis, becomes an asserted validation, or is abandoned.   |
| D7  | OPEN       | Decide how to isolate the 30-day instruments.                                                                    |
| D8  | ANSWERED   | ADR-0379 preserved the seller-plane services and the completion program depends on both.                         |
| D9  | SUPERSEDED | The locked “eight adapters” premise does not define which of three different provider counts it freezes.         |
| D10 | ANSWERED   | Paid launch remains held on four receipts, now downstream of T8 and the one-SHA fleet.                           |
| D11 | OPEN       | Choose whether and how to use the August 2 Article 50 timing hook.                                               |
| D12 | ANSWERED   | ADR-0379 froze buyer copy and the tracker trigger-parked the proposed copy wave.                                 |
| D13 | OPEN       | Choose how to validate the economic-buyer/procurement map.                                                       |
| D14 | SUPERSEDED | ADR-0385 changed the evidence-pack boundary; auditor acceptance must test the new artifact.                      |
| D15 | OPEN       | Decide when learning and revenue clocks arm relative to receipts, rails, instrumentation, and service economics. |

## Current dependency spine

The re-walk must not flatten locked future state into deployed reality:

1. **T8 is next.** The field-crypto KMS async refactor precedes fleet deployment
   (`docs/state/outstanding-work.md:35-39,135-145`; ADR-0387).
2. **Then arming and one-SHA fleet.** Rotate/adopt recorded secrets, deploy all six legs, apply
   migration 0030, and produce parity/probe evidence
   (`docs/state/outstanding-work.md:146-152`).
3. **Then the first release train.** It knowingly carries the old $1,449/$2,059 pricebook
   (`docs/state/outstanding-work.md:150-155`; ADR-0386).
4. **Then the OSCAL wave.** `@caisson/oscal-spine`, Compliance $1,649, Everything $2,259, and
   renewal/catalog changes are locked but not started
   (`docs/state/outstanding-work.md:98-119`; ADR-0383/0384/0386).
5. **Then the second release train.** Public npm publication should wait for that train unless a
   later lock says otherwise (`docs/state/outstanding-work.md:150-155`).
6. **Demand is separately gated.** The tracker starts the demand program only after all four
   technical receipts (`docs/state/outstanding-work.md:66-81`); paid launch additionally needs
   auditor, commerce, business, and public-release gates.

## D1 — public falsifiable claims

**STATUS: ANSWERED**

The old row bundled a dead install success state, an exposed sandbox/dead pay path, and a WORM
COMPLIANCE overclaim. The current answer is already encoded:

- PR #327 / `ea2bee11` changed the hero terminal from success-state “ready” to honest
  “private beta” framing and changed the WORM copy from a false COMPLIANCE posture to current
  GOVERNANCE mode with a typed COMPLIANCE escalation at launch. The site deployment succeeded and
  was live-verified (`docs/deploy/STATE.md:31-41`;
  `apps/site/components/dual-door-hero.tsx:99-118`).
- ADR-0379 lock 10 keeps marketing public while cart, dashboard, and checkout remain
  Cloudflare-gated. The launch runbook still describes Paddle sandbox and gated commerce
  (`docs/ops/launch-runbook.md`).

The CLI string still appears as a private-beta/product example elsewhere in the site; it is no
longer presented as a publicly successful install receipt. Do not reopen D1 unless that
qualification or the commerce gate regresses.

**Dependencies:** public-release gate; Paddle production; the D10 proof receipts. No D1 choice
remains.

## D2 — five design-partner emails

**STATUS: ANSWERED**

The old “same week after D1” choice was overtaken by ADR-0379 lock 10 and the reconciled tracker:
paid launch and demand activity wait for the proof/operator gates, and the five design-partner
emails start only after all four technical receipts
(`knowledge/decisions/ADR-0379-full-state-completion-program-locks.md:47-49`;
`docs/state/outstanding-work.md:66-81`). D1 being fixed is necessary but no longer sufficient.

**Ground truth:** hold the five sends. They are not cancelled and no prospect has been consumed.

**Dependencies:** D10 receipts first; D15 determines the clocks and instrumentation under which the
sends are interpreted.

## D3 — public exposure posture

**STATUS: ANSWERED**

ADR-0379 lock 10 selects the split posture: marketing remains public; cart/dashboard/checkout stay
Cloudflare-gated; paid launch and demand wait. The tracker separately holds the OSS mirror and npm
artifacts until the business and release gates
(`knowledge/decisions/ADR-0379-full-state-completion-program-locks.md:47-49`;
`docs/state/outstanding-work.md:66-81`).

The deployed site is therefore not evidence of a live self-serve transaction path. Current
Paddle/catalog and Mercury/business work remains operator/external work.

**Dependencies:** T8 → arming → fleet → release; Paddle production; business gates; public-release
gate. No exposure choice remains in this re-walk.

## D4 — Compliance price posture

**STATUS: SUPERSEDED**

The old question asked whether to lock, raise, lower, or test the displayed $1,449 price.
ADR-0383 later locked `@caisson/oscal-spine` at $249 and Compliance at **$1,649**; ADR-0384 locked
Compliance renewal at **$659**; ADR-0386 locked Everything at **$2,259** and renewal at **$899**.

Those are locked target values, not current runtime facts. The OSCAL/reprice wave has not started,
and deployed docs/support continue to answer $1,449 until the later fleet redeploy
(`docs/state/outstanding-work.md:98-119`). The first release intentionally carries
$1,449/$2,059; the second train carries the new prices
(`docs/state/outstanding-work.md:150-155`).

**Replacement question:** after the OSCAL wave and second release make $1,649/$2,259 real, what
clean, separately measured buyer-reaction sample is required before any further price change?

**Dependencies:** T8 → fleet → first release → OSCAL wave → second release. Do not run a price
experiment against values that buyers cannot actually transact.

## D5 — meaning of a discounted partner purchase

**STATUS: OPEN**

ADR-0297 offers 40% off the then-current bundle price. That means **$869.40 at the currently
deployed $1,449 anchor** and **$989.40 after the locked $1,649 reprice is actually deployed**. A
discounted transaction can establish a real relationship and artifact exchange without proving
that the buyer would pay list.

1. **Two-ledger classification (Recommended).** Record the paid amount as discounted-partner
   conversion plus relationship/proof/case-study validation, and record list-price reaction in a
   separate field; cost: more disciplined CRM/analysis, while preserving an honest elasticity read.
2. **Explicit list-confirmation supplement.** Count the purchase as discounted conversion and ask
   the buyer to separately confirm whether the then-live list price would have been approvable;
   cost: another procurement question and still no full-price transaction evidence.
3. **Treat the discounted close as list validation.** Collapse the discount and list ledgers; cost:
   the fastest headline forecloses a trustworthy read of discount sensitivity and overstates what
   cash actually proved.

**RECOMMENDATION:** Option 1. **Confidence: HIGH.** ADR-0297 fixes the transaction terms, while
`EVIDENCE-firstparty.md` E-D21 and `memo-business-model.md` establish that the corpus has no
full-price Compliance purchase. The separate ledger is the only option that does not manufacture
evidence.

**Dependencies:** D4 target-vs-live price distinction; D7 instrument schema; D15 clock arming.

## D6 — compliance wedge: pivot or persevere

**STATUS: OPEN**

The compliance wedge is locked positioning, not validated demand. The current program has built
more product evidence, but the demand ledger still has no paid partner outcome and no completed
economic-buyer test (`DEMAND-LEDGER.md`; `EVIDENCE-firstparty.md` E-D1/E-D3/E-D16).

1. **Persevere as a bounded thesis (Recommended).** Keep the compliance wedge through one
   pre-registered 30-day run and preserve the exact tripwire, “zero paid partners at day 30 stops
   further product spend and reopens the wedge or pivot board”; cost: one bounded cycle before a
   pivot, while foreclosing indefinite thesis protection.
2. **Treat the wedge as validated and continue without a tripwire.** Convert product depth and
   proxy reactions into sufficient validation; cost: avoids a near-term pivot decision but
   forecloses a falsifiable interpretation of continued spend.
3. **Pivot before the demand run.** Stop treating compliance as the lead wedge now; cost: avoids
   another cycle but abandons the thesis before the buyer-map, list-price, partner, and public
   developer instruments run cleanly.

**RECOMMENDATION:** Option 1. **Confidence: MEDIUM.** The evidence supports testing, not certainty:
buyer objections and competitor pressure are real, but no clean paid-demand run exists. The
verbatim tripwire prices the remaining bet.

**Dependencies:** decide D15, D13, D5, and D7 before the clock starts; execute only after D10's
receipts.

## D7 — 30-day instrument design

**STATUS: OPEN**

The existing ledger mixes different questions—buyer authority, price reaction, discounted
conversion, and developer distribution—whose nulls have different meanings.

1. **Four separate pre-registered instruments (Recommended).** Run buyer-map interviews,
   then-live-list-price reactions, discounted-partner conversion, and public developer
   distribution with separate denominators and success/failure criteria; cost: four logs and more
   operating discipline, while preserving attribution.
2. **Buyer-map first, then sequential commercial/distribution tests.** Do not expose price or
   offers until the economic-buyer route is known; cost: cleanest causal sequence but a slower
   30-day learning cadence.
3. **One mixed market-contact sprint.** Count all interviews, replies, clicks, and purchases in one
   funnel; cost: easiest to run but forecloses diagnosis when the aggregate result is zero or weak.

**RECOMMENDATION:** Option 1. **Confidence: HIGH.** `DEMAND-LEDGER.md`,
`EVIDENCE-product-data.md`, and `EVIDENCE-firstparty.md` E-D8/E-D9 show that the current evidence
classes and denominators differ. Separate instruments are required for an interpretable D6
tripwire.

**Dependencies:** D13 defines who enters the buyer-map instrument; D5 defines conversion labels;
D15 defines when learning and revenue clocks arm.

## D8 — seller-plane services

**STATUS: ANSWERED**

ADR-0379 lock 11 preserves the current architecture, and the completion program explicitly deploys
both docs-RAG and support-bot in the one-SHA fleet
(`docs/state/outstanding-work.md:90-92,146-152`). Scaling either service to zero would contradict
the locked completion program, not merely choose an implementation detail.

Ground truth corrects the old row's language:

- `services/docs` is a TypeScript/Bun service (`services/docs/package.json`;
  `services/docs/src/server.ts`).
- `services/support-bot` is Python (`services/support-bot/pyproject.toml`).
- the repository's other `pyproject.toml` is the `tools/assert-lane` evaluation tool, not a second
  seller-plane runtime.

The decision outcome—keep both seller-plane services—is answered even though ADR-0379's phrase
“Python remains two services” is not a precise description of today's file layout.

**Dependencies:** T8 → arming → one-SHA fleet; docs/support price probes after the OSCAL wave.

## D9 — all other consolidation candidates

**STATUS: SUPERSEDED**

The old recommendation froze “eight LLM adapters and six `agent-*` families.” The six-family count
still matches the package tree: `agent-dev`, `agent-kernel`, `agent-runner`, `agent-trajectory`,
`agent-usage`, and `agentic-dev`. The provider number is not a stable unit:

- `packages/ai-config/src/config.ts:25-37` accepts **11 provider modes**: OpenAI, Anthropic, Google,
  OpenRouter, local, Bedrock, Azure OpenAI, Ollama, Groq, Mistral, and Together.
- `packages/ai-kit/src/providers.ts:107-194` expresses those modes as **eight switch branch groups**
  because Groq/Mistral/Together share one branch and local/Ollama share another.
- the same file imports **six SDK adapter factories** because several branch groups use
  `createOpenAICompatible`.

ADR-0379 lock 11 and the old board do not define whether “eight adapters” means modes, branch
groups, or SDK factories. Therefore the old numeric freeze is not safely executable even though
“do not expand” remains clear.

**Replacement question:** which provider unit is the architectural boundary—11 public config
modes, eight resolver branch groups, or six SDK adapter factories—and which changes count as an
expansion? Resolve by superseding ADR, not by relabeling modes in this prep.

**Dependencies:** any provider addition/removal; T8 touches `ai-kit` but does not authorize this
reconciliation.

## D10 — paid-launch proof gate

**STATUS: ANSWERED**

ADR-0379 and the live tracker hold paid launch on four reproducible receipts:

1. COMPLIANCE-mode WORM proof;
2. deployed-pooler RLS attestation;
3. split-brain recovery proof; and
4. KMS-backed signing proof.

The tracker still requires two or three independent working-auditor reviews, Paddle production,
business gates, and public-release evidence in addition to those technical receipts
(`docs/state/outstanding-work.md:66-81`; `docs/ops/launch-runbook.md`).

ADR-0387 changes the execution path, not the gate: T8 must make Azure KMS-backed field crypto
viable before arming and the one-SHA fleet; only that deployed fleet can produce credible
environment receipts. Code inspection alone is not a paid-launch substitute.

**Dependencies:** T8 → arming → fleet/migration/parity → four receipts → auditor acceptance and
operator/external gates.

## D11 — Article 50 correct-the-rumor content

**STATUS: OPEN**

The European Commission published its final Article 50 transparency guidelines on
**2026-07-20** and says the obligations apply from **2026-08-02**. EUR-Lex Article 113 gives the
same applicability date. The Commission's quick facts describe a limited grace period through
December 2026 for the Article 50(2) marking obligation for generative systems placed on the market
before August 2; that is not a blanket postponement of Article 50.

1. **Verify now and publish by August 1 (Recommended).** Draft from the July 20 final guidance,
   verify scope and the narrow December grace-period statement with a named factual/legal pass,
   then publish before the applicability date; cost: an eight-day interruption and reviewer time,
   while preserving the live hook.
2. **Publish an evergreen explainer after August 2.** Remove the countdown/news frame and favor
   durable accuracy; cost: lower execution pressure but forecloses the strongest current-attention
   window.
3. **Skip the article.** Keep Article 50 material limited to product/framework documentation;
   cost: zero distraction but forfeits a dated authority-building opportunity aligned with the
   compliance wedge.

**RECOMMENDATION:** Option 1. **Confidence: MEDIUM.** The timing and guidance are primary-source
facts; the unknown is distribution value. The verification gate is mandatory because a
trust-market vendor being wrong about the rule is more costly than missing the hook.

**Primary sources:** [Commission guidelines](https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems),
[Commission quick facts](https://digital-strategy.ec.europa.eu/en/factpages/quick-facts-transparency-rules-ai-systems),
and [AI Act Article 113](https://eur-lex.europa.eu/eli/reg/2024/1689/oj?locale=en).

**Dependencies:** decision today; factual/legal review; publication by August 1 for the timely
option. Independent of T8, fleet, release, OSCAL, and commerce.

## D12 — message-match copy fixes

**STATUS: ANSWERED**

The old row recommended immediate hero-level ISO/NIST naming, a month-13 answer at the decision
point, footnote reframing, `/partners` instrumentation, and Sentrik/Probo comparison pages.
ADR-0379 instead froze buyer-facing copy for the completion program, and the reconciled tracker
parks the future copy wave under CAISSON-130
(`knowledge/decisions/ADR-0379-full-state-completion-program-locks.md:47-49`;
`docs/state/outstanding-work.md:157-169`).

Current source confirms this is a defer, not a hidden completion:

- `/partners` still uses bare support mailto links
  (`apps/site/app/(marketing)/partners/page.tsx:190,213`);
- the comparison registry has neither Sentrik nor Probo
  (`apps/site/lib/comparisons.ts`);
- the requested hero-level message-match changes are not present.

Do not convert those absences into active work during CAISSON-150. They reopen only on the
documented copy trigger or a superseding lock.

**Dependencies:** CAISSON-130 trigger; future copy wave. No current operator choice.

## D13 — buyer-map validity

**STATUS: OPEN**

The corpus contains technical-champion reactions but no evidence that the champion controls the
compliance budget, can procure owned source code self-serve, or knows what the working auditor
will accept (`EVIDENCE-firstparty.md` E-D5/E-D7/E-D10/E-D11; `memo-positioning.md`). Product depth
does not close that commercial gap.

1. **Recruit 3-5 economic buyers/procurement owners (Recommended).** Interview regulated-SaaS
   budget owners who were not recruited as developer-panel respondents, recording budget owner,
   procurement path, self-serve acceptability, and auditor role; cost: targeted recruiting and
   calendar time, while preserving role validity.
2. **Embed buyer-map questions in design-partner calls.** Ask technical champions to bring or
   identify their budget/procurement owner; cost: cheaper recruiting but role contamination and
   weaker evidence when only the champion attends.
3. **Assume champion-to-owner proximity and proceed.** Treat developer interest as an adequate
   buyer map; cost: fastest path but risks interpreting a procurement-structure failure as a
   product or price failure.

**RECOMMENDATION:** Option 1. **Confidence: MEDIUM on method, NONE on the buyer answer.** Every
first-party source establishes the missing seat; none supplies its view. Direct economic-buyer
evidence is the shortest valid closure.

**Dependencies:** run before D7's price and conversion instruments; D15 learning-clock gate.

## D14 — auditor acceptance of the evidence pack

**STATUS: SUPERSEDED**

The old question referred generically to a “WORM-chain evidence pack” in place of a Vanta-style
report. ADR-0385 materially changed that artifact boundary:

- the evidence pack carries no embedded executable verifier;
- `@caisson/verify-pack` is the separate verifier and is honestly documented as not publicly
  published yet;
- the canonical file manifest is sealed; and
- exports fail closed through per-event allowlists.

The implementation is complete in the reconciled tree
(`docs/state/outstanding-work.md:120-134`), but there is still no working-auditor acceptance
evidence. The old artifact question cannot be answered against the new artifact by inheritance.

**Replacement question:** will two or three working auditors accept the ADR-0385
manifest-sealed pack plus out-of-band verifier, and what conditions, formats, custody records, or
independent execution do they require?

**Dependencies:** `@caisson/verify-pack` availability to the reviewers; D10 independent-acceptance
gate; OSCAL wave may change the package surface but must not be allowed to substitute for auditor
evidence.

## D15 — arming the learning and revenue clocks

**STATUS: OPEN**

The live tracker separates technical proof, independent acceptance, commerce, business, public
release, and demand gates. It starts demand work after the four receipts, while paid launch still
requires Paddle production, business readiness, auditor acceptance, and public-release acts
(`docs/state/outstanding-work.md:66-81`). There is still no written cost-to-serve pass bar for
support, security response, or auditor assistance.

1. **Use separate learning and revenue clocks (Recommended).** After all four receipts, arm
   interviews and the five emails under complete exposure/send instrumentation; arm the 30-day
   paid-revenue tripwire only after auditor acceptance, Paddle/Mercury and a proved real
   transaction path, and a written support/cost-to-serve bar; cost: two clocks and more state
   discipline, while preventing rail failures from masquerading as demand failure.
2. **Use one clock after every gate.** Delay interviews, distribution, and revenue measurement
   until receipts, auditors, commerce, business, instrumentation, and service economics are all
   green; cost: cleanest cohort but needlessly delays non-transaction learning.
3. **Arm the 30-day clock now.** Count elapsed calendar time while T8, fleet, proof, rails, and
   instrumentation remain incomplete; cost: fastest apparent accountability but forecloses an
   interpretable null because many prospects cannot yet buy or be measured.

**RECOMMENDATION:** Option 1. **Confidence: MEDIUM-HIGH.** It follows the tracker's existing
separation between receipt-gated demand and paid-launch gates while making the missing revenue
preconditions explicit. It is the only option that learns early without charging infrastructure
delay to the wedge.

**Dependencies:** D10 receipts arm learning; D13/D7 define learning; D5 defines conversion labels;
auditor acceptance, Paddle/Mercury, instrumentation, and the cost-to-serve bar arm revenue.

## Operator decision order

The six open decisions do not all belong in one linear meeting:

1. **D11 now — hard timing priority.** Choose the Article 50 content path first. It is independent
   of every build dependency and loses value each day before August 2.
2. **D15 next — measurement boundary.** Decide which clocks exist and exactly what arms them
   before discussing a 30-day pass/fail.
3. **D5 and D13 in parallel.** D5 fixes the evidence labels; D13 fixes who counts as a buyer.
   Neither depends on the other.
4. **D7 after D5/D13.** Pre-register instruments with correct buyer roles and conversion labels.
5. **D6 last.** Select the bounded wedge posture and tripwire only after the operator can see what
   the 30-day run will actually measure.

D1-D3, D8, D10, and D12 are skip rows: their outcomes are already locked. D4, D9, and D14 are
replacement-question rows: they require later decision work on their corrected premises, not a
revival of the old board options.

## Re-walk close conditions

Before CAISSON-150 can call the fork walk prepared:

- every D1-D15 row has exactly one status;
- every ANSWERED row cites the later lock or completed act;
- every SUPERSEDED row states the invalid premise and replacement question;
- every OPEN row has 2-4 mutually exclusive options, one recommendation, confidence, evidence,
  cost, and foreclosed path;
- target pricing is not presented as deployed pricing;
- D11 is decided with the August 2 timing visible;
- no ADR, fork-board row, product file, or state tracker is changed by this preparation.

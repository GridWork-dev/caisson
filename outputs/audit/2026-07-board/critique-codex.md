# CODEX critic — Phase 2

## Verdict

This board did not produce eight independent reads. It produced one dominant story in
eight dialects:

> Caisson's compliance wedge is basically right, the product is basically ready, the
> missing move is market contact, the live price should be held while tested, and further
> building should stop.

The contact-before-more-build conclusion is probably directionally right. The evidence does
not justify the causal certainty wrapped around it. The board repeatedly mistakes an
activity ledger with no recorded send for proof that no send occurred, a free-tier
flipgate receipt for paid-product readiness, paid research reactions for a coherent buyer
market, and a discounted design-partner purchase for validation of a list price the buyer
will not actually pay.

The board's gravest defect is not excessive pessimism. It is premature convergence. Every
seat except T2 protects the basic product thesis; even S2's “contrarian” inversion declines
to invert the wedge. The result is a board that attacks sequencing, copy, architecture,
proof, and launch mechanics while leaving the load-bearing commercial assumption largely
untouched: that a technical champion inside a regulated software company both wants
code-owned compliance infrastructure and can cause a one-time source-code purchase.
Nothing in the pack demonstrates that buyer-and-authority combination.

## 1. The checklist

### Where the seats agreed too easily

#### 1. “Zero executed market contact” was promoted from an audit limitation into a fact

The Demand Ledger says **0 confirmed sends** and “no independent send confirmation found.”
That is not the same proposition as “the five emails sat unsent,” “none has even been
contacted,” or “zero executed field contact.” S1, S2, S3, T3, and S4 all cross that line.
The corpus is a git record, not the founder's email outbox, CRM, calendar, or memory. An
absence of an appended log proves deficient instrumentation. It does not prove deficient
activity.

This distinction does not rescue the GTM motion: zero replies, partners, checkout sessions,
and revenue remain the only recorded state. It does invalidate the board's confidence that
it has diagnosed founder avoidance rather than recordkeeping failure, list failure,
deliverability failure, an off-repo send, or a deliberate launch-gate hold.

#### 2. The compliance wedge was spared the adversarial standard applied to everything else

The case for ADR-0040 is a stack of proxies:

- E-D16 is desk-research keyword economics, explicitly WEAK and explicitly not evidence of
  Caisson conversion.
- E-B5 is an inferred complaint synthesis about GRC SaaS buyers, not evidence that those
  buyers will purchase a TypeScript source-code product.
- E-D1 is ten reactions to a retired $1,049 price from an “ICP-adjacent” cohort with
  acknowledged off-fit participants.
- E-D3's survey panel was 68% “Other,” while the real-interview frame split was nearly even.
- E-D5 says proof is missing; it does not say the underlying product is desired once proof
  exists.

S2 admits that the contrarian case against the wedge is weak, and S4 calls the hero one of
the few actively validated decisions. Neither conclusion survives the evidence tiers they
themselves cite. The pack supports a compliance **hypothesis worth testing**. It does not
support “the wedge is right.”

#### 3. “All technical gates are green” was allowed to escape its scope

DEMAND-LEDGER §0 reports that the **free-tier flip's** engineering/technical gates were
green as of a 2026-07-17 recon. It does not certify paid launch readiness. The same ledger
says npm has never published, Paddle is sandbox-only, there is no live checkout, and the
business gates are unresolved. T2 alleges four launch-blocking security/proof defects from
direct source reads. T3 alleges that the first install command fails and checkout
dead-ends.

S2 nevertheless turns the narrow receipt into “the product is done” and “every technical
go-live gate is green.” S3's recommendation likewise assumes the artifact is ready for
real-price testing. A synthesis that repeats this phrase without its free-tier scope would
launder a category error.

#### 4. Thirty days became a ritual, not an identified experimental window

S1, S2, S3, S4, and T3 all converge on an immediate 30-day motion, but the proposed
instruments answer different questions:

- a discounted design-partner purchase tests a discounted relationship, not $1,449 WTP;
- a Show HN star tests developer attention, not regulated-buyer purchase authority;
- an AEO citation tests indexability, not demand;
- a cold-email non-response tests the list, sender, offer, copy, deliverability, and timing
  simultaneously;
- a $1,449 verbal reaction tests stated price response, not ability to complete checkout.

Calling these all “market contact” hides the confounds. The board needs separate
pre-registered questions and disjoint success criteria, not a mixed sprint whose result can
be explained after the fact.

#### 5. The live $1,449 price was treated as both sacred and testable through a 40% discount

ADR-0297's first-five partner pays $869.40, not $1,449. S1's arithmetic makes this explicit
and then still treats one paid partner as the sprint's price-validation pass bar. S2 and S3
pair “show $1,449 verbatim” with the same discounted partner motion. A buyer can call
$1,449 reasonable and only transact because the actual invoice is $869.40. That outcome
validates neither list-price conversion nor ordinary-buyer willingness to pay.

If the first cohort is meant to buy proof, feedback, and case-study rights, say so. Do not
also use it as evidence that ADR-0373's price clears.

### Which shared assumption is unvalidated

The shared unvalidated assumption is not merely “there is demand.” It is more specific:

> The person who values fail-closed RLS, WORM evidence, OSCAL crosswalks, and owned source
> is close enough to the person who controls a compliance budget that a self-serve,
> one-time code purchase can close without a services or procurement layer.

The corpus never establishes that chain.

- E-D5 separates technical inspection from the economic buyer's proof needs.
- E-D7 shows that framework credibility changes by segment.
- E-D10 names DIY agents as a substitute for one partially usable respondent.
- E-D11 says ownership does not imply self-sufficiency.
- E-B5 describes buyers trained to purchase workflow SaaS and auditors.
- DEMAND-LEDGER contains no prospect, opportunity, procurement event, security review,
  invoice, or paid buyer.

The board assumes the missing ingredient is proof or outreach. It could instead be a broken
buyer map: the champion likes the code, the economic buyer buys an auditor/platform, and
neither owns the gap between them. That possibility deserves a direct test before the wedge
is called corroborated.

Secondary unvalidated assumptions:

1. The five Segment-A drafts target reachable people with purchase authority. The pack
   shows research and ranking, not email validity, role authority, sender reputation, or
   deliverability.
2. The site has been publicly exposed long enough for one visitor in a 30-day window to
   say anything about demand. The spot audit proves reachability on July 23, not exposure
   duration, indexation, distribution, or non-operator source.
3. A public OSS/module launch will create commercial proof rather than attract only free
   users. ADR-0094 describes the boundary; it does not validate the conversion mechanism.
4. First-five design partners can pay inside 30 days. OPERATOR-CONSTRAINTS says Mercury and
   Paddle are gated and not dated. A no-sale outcome can therefore be a payment-rail result,
   not a demand result.

### Who is missing from the room

#### A seller who owns the channel

There is a Capital Skeptic, Contrarian Founder, Buyer narrator, Positioning Strategist,
engineering seats, security, craft, and consolidation. There is no GTM operator accountable
for list quality, deliverability, contact sequencing, qualification, CRM evidence, call
design, follow-up, and conversion. This omission is perverse because “send the five emails”
is the board's most repeated recommendation. No seat audits whether those five are still
valid prospects, whether the recipient is the buyer, whether the sender domain is ready, or
what happens after a reply.

#### An actual economic buyer or procurement owner

S3 is not a buyer. It is a transcript narrator speaking through a paid,
ICP-adjacent sample. Study 2 has only two to three usable responses; the corpus does not
establish purchase authority; no participant entered a real buying process. The room lacks
the regulated SaaS CTO/CISO/compliance lead who can explain budget ownership, auditor
acceptance, vendor-risk review, source-code procurement, security review, and the conditions
under which owned code is preferable to Vanta, a consultant, or internal work.

#### Claims/procurement counsel

T2 reviews security paths, not commercial claim liability, indemnity, source-code
acceptance, proof/case-study rights, or the contract consequences of “perpetual,” “real
person support,” root-resistant WORM, and audit-verifiable controls. ADR-0080 is treated as
a copy constraint, but no seat tests whether the full sales surface plus EULA creates an
obligation a solo operator can actually service.

### What risk nobody named

#### The proposed experiment cannot distinguish demand failure from transaction failure

The board wants a paid partner in 30 days while the payment/banking gates are pending and
the only live terms include a 40% discount. A zero-sales result would conflate lack of
demand, inability to pay, procurement delay, list quality, and product unreadiness. A sale
would validate $869.40 partner terms, not $1,449 self-serve terms. The headline experiment
is therefore incapable of producing the binary conclusion several seats want from it.

#### Success may be more dangerous than failure

The first customer buys an unlimited-personnel, perpetual code artifact at $869.40 while
the research says support ambiguity is a major objection. T1 wants the custom docs/support
stack scaled to zero; T3 wants support promises made more prominent; S3 says support is
part of the purchase decision; S1 excludes support labor from its cash math. Nobody prices
the support, security-response, patch, framework-update, onboarding, and auditor-assistance
tail of a regulated design partner.

One customer can therefore produce positive cash and negative solo-founder capacity. The
board's “one paid partner” pass bar has no cost-to-serve or support-boundary condition.

#### The measurement substrate is too weak to support kill criteria

There is no reliable public-exposure start date, no confirmed waitlist count, no partners
CTA event, no send log, no checkout, and no activation schema. Yet multiple seats propose
zero replies/stars/waitlist entries as a pivot trigger. Kill criteria on an uninstrumented
system punish the product for the measurement failure.

### Disagreements the synthesis must not erase

1. **Public exposure:** S2 wants the OSS mirror flipped now; T3 says restore the access gate
   until install and pay actions are true.
2. **Paid launch:** S1 wants a paid-partner result in 30 days; T2 says hold paid launch
   until four security/proof receipts exist.
3. **Support stack:** T1 wants docs/support services scaled to zero; S3 and T3 say support
   clarity and proof are central buyer needs.
4. **Deletion:** T1 calls the seller plane reckless debt; T4's committed list is
   kill-nothing, merge-nothing.
5. **Positioning:** S4 wants the incumbent GRC/DIY-agent alternative made explicit; S2
   retains compliance but tests AI-spend and OSS-led vectors; those are not the same
   acquisition thesis.

Any synthesis that reports “the board agrees: launch a 30-day validation sprint” without
these conflicts is synthesis laundering.

## 2. Citation-entailment audit

### Method and evidence fractures

I sampled the five numbered/tagged claims in every memo: 40 claims total. For each claim I
re-opened every cited E-id in its indexed section file and applied the binding spot-audit
corrections. “Pass” means the cited evidence entails the material factual proposition at
the stated confidence. “Stretched” means the source supports a narrower proposition,
negative-space was promoted to a zero, or an inference was tagged as observed/corroborated.
“False as cited” means the evidence contradicts the claim or does not support its key fact.

Four fractures in the pack itself affect multiple memos:

1. **E-D15 contradicts E-D9/E-D10.** E-D15 says Study 2 did not deliver a clean verbatim
   $2,059 reaction. E-D9 and the spot audit say the mandatory $2,059 probe was delivered as
   specified on exactly 2/5 sessions; E-D10 reports reactions to $2,059. Claims relying on
   E-D15's absolute wording are unsafe.
2. **E-I2's section text is stale.** EVIDENCE-repo still describes a large in-flight
   redesign branch. EVIDENCE.md and the persona contract bind the correction: ADR-0378 is
   merged and deployed. A memo cannot cite the old branch state after acknowledging the
   correction.
3. **The Demand Ledger's Cloudflare gate statement is stale.** The spot audit proves the
   marketing surface was openly reachable on July 23. It does not establish when it became
   reachable or how much public exposure occurred.
4. **E-A counts drift.** E-A1/E-A7 say 302 ADRs and 23 pending changesets; the spot audit
   corrects only the ADR count to 328. T4's “24 pending changesets” has no support in the
   pack.

### S1 — Capital Skeptic

| Claim | Verdict         | Entailment attack                                                                                                                                                                                                                                                        |
| ----- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Pass            | E-A1/A2/A4, corrected E-A7, E-P1/P2, and the ledger support the scale-versus-recorded-funnel contrast.                                                                                                                                                                   |
| 2     | Pass with bound | The arithmetic is correct. E-D21's $80–130 is an independent stack tally containing some `watch`/`confirm` rows, not a clean invoice-grade fixed-cost denominator; the memo appropriately labels the result INFERRED.                                                    |
| 3     | **Stretched**   | “Every Study-1 price reaction tested $1,049” erases the two participants who never saw the real number and reacted to self-generated anchors. The defensible claim is: all ten reactions to the actual Compliance price were to $1,049, and nobody was tested at $1,449. |
| 4     | **Stretched**   | E-D8/E-D9 support usable-n and two clean probes. E-D21 does not support the cited ~$122 Study-2 spend; that figure appears in DEMAND-LEDGER §2. The calculation is reproducible only after substituting the uncited ledger row.                                          |
| 5     | Pass            | The six-month burn arithmetic follows E-D21, and E-C1 explicitly describes 193→632 rules over nine days. It remains a hypothetical burn scenario, correctly tagged INFERRED.                                                                                             |

S1's material citation defect is narrow, but its experiment conclusion is not: a partner
paying $869.40 cannot validate $1,449 merely because the list price was spoken aloud.

### S2 — Contrarian Founder

| Claim | Verdict           | Entailment attack                                                                                                                                                                                                                                                            |
| ----- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | **Stretched**     | DEMAND-LEDGER proves “0 confirmed sends,” not that five emails “sat unsent.” Its green technical-gate receipt is scoped to the free-tier flip, not every paid-product launch gate. E-D22 is also stale on CF Access.                                                         |
| 2     | Pass with bound   | E-C1/C2/C3 support the competitor-velocity facts. “Closed most of the gap” is the collector's qualitative judgment, not a measured feature-parity result, but S2 does not materially exceed E-C1's own wording.                                                              |
| 3     | **False in part** | The live $1,449 price is untested. The attached claim that $2,059 “has never had a clean verbatim reaction” is contradicted by E-D9 and the spot audit, which record two correctly delivered mandatory probes, and by E-D10's reported reactions. E-D15 is internally stale. |
| 4     | Pass as inference | Public reachability plus one visitor is supported. “Beginning to falsify itself” is an inference, and the memo explicitly labels the signal weak and days-old. It must not be promoted beyond that.                                                                          |
| 5     | **Stretched**     | E-D16 is WEAK keyword proxy evidence, E-B5 is an inferred complaint synthesis, and E-D1 concerns an obsolete lower price. Together they justify “worth testing,” not “the corpus supports the locked hero.”                                                                  |

S2's contrarian method fails at the decisive moment: it inverts sequencing but exempts the
wedge from the same burden of proof.

### S3 — Voice of Buyer

| Claim | Verdict                              | Entailment attack                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | **False as worded**                  | “Every price reaction we ever gave was at $1,049” is contradicted by E-D10's $2,059 reactions. The accurate narrower claim is that no buyer reacted to the live **Compliance** price of $1,449. E-D15 cannot repair the overstatement because it conflicts with E-D9/E-D10.                                                                                                                                                             |
| 2     | **Stretched**                        | E-D5 supports third-party proof as the top objection, and the ledger supports zero recorded customers/partners plus a private OSS repo. It does not support “none of it can exist”: E-B3 documents inspectable code artifacts, and a working demo is not logically contingent on an existing customer. Testimonials/case studies are the genuinely absent artifacts.                                                                    |
| 3     | Pass with sample bound               | E-D4 supports the 5/12 regime mismatch and verbatim dealbreaker; E-D7 supports the federal grammar at n=1; E-B2/B4 support SOC 2/HIPAA-led copy. The memo preserves the n=1 caveat.                                                                                                                                                                                                                                                     |
| 4     | **Stretched**                        | E-D6/E-D11 support the buyer concern. E-B2 is a homepage summary and cannot prove that the live pricing surface omits a month-13 answer. T3's direct source read actually finds that answer on `/marketplace/plans`, just not at the homepage decision point. “Unresolved everywhere” is not entailed.                                                                                                                                  |
| 5     | **Stretched, with a false subclaim** | The ledger proves no recorded send/reply/partner/waitlist/revenue, not zero actual field contact. E-D8/E-D9 support the poor instrument execution. The follow-on claim that the named closer “has never been run at any anchor” is too absolute: Study 1 produced ten actual-price reactions and Study 2 delivered two specified $2,059 probes; what has not run is a clean, properly screened n≥5 round at the **live $1,449** anchor. |

S3 violates its own discipline by turning “the corpus is silent” into “we know it did not
happen.” A buyer-voice seat should be the last seat allowed to do that.

### S4 — Positioning Strategist

| Claim | Verdict                    | Entailment attack                                                                                                                                                                                                                                                                                                                  |
| ----- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | **Stretched**              | E-D10 proves one partially usable respondent named a $100/month Codex/Claude substitute. It does not establish this was the **only** substitute any real buyer named. E-B2's homepage summary also cannot prove omission from the full comparison surface; the memo's direct repo read, not its E-ids, carries that part.          |
| 2     | Pass with external support | E-B4/E-D4/E-D7 entail the SOC 2/HIPAA versus GDPR/PCI/ISO/federal mismatch. The claim that ISO 27001 and NIST 800-53 already ship comes from direct repo paths, not the cited E-ids, but the memo labels that source separately.                                                                                                   |
| 3     | **False as cited**         | E-D16 does not report a query or zero volume for “code-owned compliance,” “compliance starter kit,” or “dev-kit.” It says compliance keywords are expensive and finished platforms own the SERP. E-B's caveat that no vendor sells RLS-as-a-service is not evidence that nobody searches for an owned-code frame.                  |
| 4     | **False**                  | “Every WTP reaction in the corpus was gathered against $1,049” omits E-D10's $2,059 reactions. “The only price-credibility signal points upward” cherry-picks #12 while ignoring two below-anchor objections in E-D10 and the acceptance decline from $1,049 to $1,499 in E-D14. The upward case is a signal, not the only signal. |
| 5     | **Stretched**              | E-C6 supports a dated Art. 50 hook and its nuance. The cited set cannot establish that it is the **only** dated why-now. E-D5/ledger/E-B1 do support the proof and awareness deficits.                                                                                                                                             |

S4's most serious failure is selection bias disguised as positioning discipline: it calls
one upward price objection the only credibility signal while discarding contrary reactions
in the same corpus.

### T1 — Staff-Eng Pragmatist

| Claim | Verdict       | Entailment attack                                                                                                                                                                                                                                                                                                              |
| ----- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | **Stretched** | E-A1/A2/A3/A8 support the inventory and deliberate thin-package patterns. They do not establish that every one of 61 packages, seven apps, and five services participates in a single “full build/test/gate surface.” That maintenance conclusion is reasonable inference, not CORROBORATED fact.                              |
| 2     | **Stretched** | E-A4 supports the Python bot, docs RAG service, and intel watcher; E-P1/P2 support absent usage signal. The cited evidence does not enumerate the asserted deploy, credential, and runbook multiplication or prove the whole “seller plane” is bespoke debt.                                                                   |
| 3     | Pass          | E-A9 explicitly distinguishes signer, verifier, HTTP issuer/entitlement service, and public-key artifact and identifies navigation/cross-seam cost rather than runtime duplication.                                                                                                                                            |
| 4     | **Stretched** | E-A10 supports the provider breadth. E-P2 says the analytics schema lacks activation events; it does not prove there is no LLM-provider usage data, no test ranking, or an unvalidated compatibility matrix.                                                                                                                   |
| 5     | **Stretched** | Corrected E-A7 supports governance volume and log size; corrected E-I2 supports a shipped redesign. “Operating drag” and “forces a solo operator to reconstruct truth” are plausible judgments but are tagged CORROBORATED without operational evidence such as time spent, stale-decision incidents, or maintenance failures. |

T1 often has the right maintenance instinct and the wrong evidence tag. Architecture-cost
judgments do not become observed merely because directory counts are observed.

### T2 — Risk & Security Assessor

T2's findings may be valid direct-source findings. The E-id citations do not prove them.
The memo uses market/repo inventory E-ids as contextual decoration while the actual evidence
is a set of source-file line references outside the Phase-0 E-id chain.

| Claim | Verdict                       | Entailment attack                                                                                                                                                                                                                      |
| ----- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | **E-id stretch**              | E-B2/B3 support general WORM marketing and visible audit-worm code. They do not state COMPLIANCE-versus-GOVERNANCE defaults, root-key resistance, or what the live test omits. Those facts depend entirely on the direct source paths. |
| 2     | **E-id stretch**              | E-A4/A9 support the license service and four-home topology. They do not show raw private-key env custody, the public service's exact signing path, or an unwired KMS signer.                                                           |
| 3     | **E-id stretch**              | E-B2/B3/B6 support the RLS promise and known footguns. They do not show that Caisson closes the named paths, that proof is PGlite-only, or that Neon/pooler role drift remains untested.                                               |
| 4     | **E-id stretch**              | E-B2/B3 support the WORM/audit-chain claim. They do not show an external put inside a DB transaction or the after-put/before-commit failure mode.                                                                                      |
| 5     | **False as an E-id citation** | E-A9 says only that license responsibilities occupy distinct homes. It does not mention signed `major`, verifier inputs, registry behavior, or a cross-major entitlement leak. The direct code paths are the sole evidence.            |

The repair is not to drop T2's findings. It is to promote the direct file reads into
auditable evidence items with quoted behavior, reproduction steps, and a second-source or
test receipt. Until then, “CORROBORATED” overstates the Phase-0 evidence chain.

### T3 — Product-Craft Critic

| Claim | Verdict                                 | Entailment attack                                                                                                                                                                                                                                                                                                                                                                     |
| ----- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Pass                                    | The spot correction establishes public reachability; the ledger establishes unpublished npm and sandbox-only checkout; E-B3 establishes the site's inspectable-artifact trust posture. Direct source paths support the concrete dead ends.                                                                                                                                            |
| 2     | **Stretched**                           | The evidence proves $1,049 research versus $1,449 live price. It does not prove that the footnote causes a buyer to infer price validation; that is a craft interpretation and should be tagged INFERRED, not OBSERVED.                                                                                                                                                               |
| 3     | **False in its proof-resolution claim** | E-D5 says testimonials/case studies/working proof are the top blocker. “No logo wall yet; here is code to inspect” is honest, but it does not answer third-party proof. The memo later concedes the proof engine has produced nobody. Calling message-match “mostly genuinely good” launders the largest unresolved gap.                                                              |
| 4     | **Stretched**                           | E-D3 supports clarity as a concern. E-D8 explicitly classifies respondent #4 as unusable because of off-fit and audio breakdowns; using #4 as evidence for how a valid buyer responds to catalog density is not permissible. The page-density critique stands only as an INFERRED walkthrough judgment.                                                                               |
| 5     | **Stretched**                           | The direct repo read may prove a bare mailto and absent event. DEMAND-LEDGER does not prove “no traffic has ever been sent toward” the page; it proves no recorded outbound sends and no page-level count. E-D5 does not establish that `/partners` is the site's **only** proof-generating engine. The “majority of browser sessions lack a wired mail client” assertion is uncited. |

T3 correctly attacks dead interactions, then goes soft on the deeper issue: honest substitute
proof is still substitute proof.

### T4 — Consolidation Minimalist

| Claim | Verdict                                     | Entailment attack                                                                                                                                                                                                                                                                                                                                          |
| ----- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Pass with tag correction                    | E-A1/A2/A3/A9 support the counts, five manifest-only bundles totaling 213 LOC, and deliberate app/package patterns. “Implementation surface is far smaller than the raw count reads” is an inference, not OBSERVED.                                                                                                                                        |
| 2     | **False as cited**                          | E-A9 explicitly says the `billing`/`billing-orchestration` and `compliance`/`compliance-core` splits were **not independently verified**. E-A5 says `infra/license-issuer` contains only a public-key document; it does not establish an ADR-0226 rotation ledger. T4's direct snapshot work may add evidence, but E-A9/E-A5 do not corroborate the claim. |
| 3     | **False in current-state detail**           | E-A8 and E-P1 support scale and traffic. Corrected E-I2 says ADR-0378 is merged/deployed, not that a branch is “still absorbing +28k-line slices.” The old +28,358/-2,415 statistic spans 145 changed files and cannot be assigned wholesale to `apps/site`.                                                                                               |
| 4     | **False in count; stretched in conclusion** | E-A1 reports 23 pending changesets, not 24. Corrected E-A7 supports 328 ADRs and the index/build-state/archive scale. “Undeletable by design” and “upkeep rivals a mid-size service” rely on direct ADR interpretation and metaphor, not E-A6.                                                                                                             |
| 5     | **E-id stretch**                            | E-A4 supports the Python support bot. It does not document a second `pyproject` under `tools/`, prove that exactly two Python islands exist, or establish that they are the only cross-cutting outliers.                                                                                                                                                   |

T4's “kill nothing” verdict is especially vulnerable because the memo claims exhaustive
re-verification while its E-id citations preserve the collector's explicit non-verification
flags and one stale branch state.

## 3. Strongest dissent extraction

These are the claims synthesis is most likely to soften into generic “validate demand”
language. Preserve each in its sharp form.

### S1 — Preserve the cash denominator

**A first discounted design partner produces only $869.40 gross, and even that apparent
win is not unit economics until support labor, fees, AI PAYG, and the perpetual support
tail are priced.**

Do not reduce S1 to “watch burn.” Its useful dissent is that a paid logo can still be a
cash-inefficient result.

### S2 — Preserve the depreciation argument

**Private differentiation depreciates while market learning remains at zero; code can
compound at agent speed, but validated learning begins only at first contact.**

Do not launder this into “do some outreach.” S2's claim is that delay has an observable
competitive cost and that another build week is not neutral.

### S3 — Preserve the proof distinction

**Inspectable code is not third-party proof: the economic buyer asked for a regulated
customer, case study, or passed-audit artifact, and Caisson has none.**

Do not let “the repository is the artifact” substitute for the artifact buyers actually
named.

### S4 — Preserve the DIY-agent alternative

**At least one real respondent compared $2,059 with building through Codex/Claude on a
$100 plan; the competitive set must test DIY-with-agents, not only boilerplates and GRC
subscriptions.**

The n is one and partially usable, so preserve it as a named alternative to test, not as a
settled market frame.

### T1 — Preserve the seller-plane challenge

**The custom docs RAG, Python support bot, and compliance-intel services impose a second
operating plane before any observed usage justifies it.**

Do not turn this into a vague architecture freeze. Either establish required pre-launch
jobs for each service or scale them down reversibly.

### T2 — Preserve the executable-proof launch gate

**A compliance-led paid launch must not rely on code inspection alone: COMPLIANCE-mode
WORM behavior, deployed-pooler RLS isolation, WORM/DB split-brain recovery, and isolated
license signing need executable receipts.**

The E-id chain is inadequate, but the dissent is still the board's only serious challenge
to “the technical gates are green.” It must be verified, not averaged away.

### T3 — Preserve the first-interaction truth test

**Do not send a skeptical buyer to a public page whose first install command references an
unpublished package and whose checkout is unavailable or sandbox-only.**

This is not copy polish. It is a falsifiable breach of the site's own artifact-truth
positioning.

### T4 — Preserve the anti-counting rule

**Directory count is not sprawl: thin bundle manifests, reference-app shells, and separated
license trust boundaries must not be merged without dead-surface or dependency evidence.**

Do not let the board's understandable impatience turn into package demolition by headline
count.

## Final synthesis constraints

The Phase-2 synthesis should be rejected unless it does all of the following:

1. Uses **“0 confirmed sends”**, never “0 sends” or “emails sat unsent,” unless an email/CRM
   source is added.
2. Quarantines E-D15's absolute $2,059 wording and uses E-D9/E-D10 instead.
3. Scopes “technical gates green” to the free-tier flip receipt and reconciles T2/T3 before
   any paid/public traffic recommendation.
4. Calls ADR-0040 a testable thesis, not a validated wedge.
5. Separates four experiments: buyer-map interviews, list-price reactions, discounted
   design-partner conversion, and public developer distribution.
6. Does not count an $869.40 design-partner purchase as $1,449 price validation.
7. Makes payment-rail readiness and instrumentation preconditions for any 30-day
   pass/fail revenue criterion.
8. Carries the five live disagreements above rather than manufacturing consensus.
9. Promotes T2's direct code findings into evidence items or labels them uncorroborated
   source-review findings.
10. Prices the customer-success/support burden before using “one paid partner” as a pass
    bar.

The board found the right next domain—contact with reality—but it has not yet designed an
experiment capable of telling it which reality it contacted.

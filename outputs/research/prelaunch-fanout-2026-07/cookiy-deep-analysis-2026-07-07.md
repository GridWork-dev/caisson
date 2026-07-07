---
title: "Cookiy deep analysis — the 45 raw transcripts, independently re-analyzed"
study_id: 019f3aeb-0939-73d2-863f-123e30d894af
date: 2026-07-07
status: final
method: >
  All 45 completed playback transcripts pulled raw via the Cookiy playback API (40 synthetic
  simulations + 5 real human panel interviews; the 4 not-qualify screens excluded). One
  structured extraction per interview (12-field schema, verbatim-quote discipline), then four
  independent cross-cut lenses — theme validation run adversarially against the vendor report,
  synthetic-vs-human delta, pricing/WTP mapped to the D2/D3 forks, and an objection/veto
  taxonomy mapped to owned surfaces — then an accuracy critic that spot-verified 25+
  load-bearing claims (quotes, counts, real-vs-synthetic attributions) against the raw text.
  Extraction data: cookiy-extractions-45-2026-07-07.json (same directory). Raw transcripts are
  re-pullable anytime via cookiy_interview_playback_get with the study_id above; the interview
  ids and kinds are in the extractions file.
relation: >
  Companion to cookiy-combined-round-2026-07-07.md (the Cookiy auto-generated report of
  record). This document is the independent verification layer over the same raw data; where
  the two disagree, this one cites transcripts and wins.
---

# Cookiy deep analysis — what the raw transcripts actually support

## Executive synthesis

**The single most important finding is about provenance, not content: the vendor report's
three executive themes rest almost entirely on the 40 synthetic personas.** Four of the five
real humans never reached a product pitch, price, or architecture question at all — the guide
ran out of time in current-state discovery — and the fifth (`real-019f3b34`, the only
ICP-adjacent human) contradicts two of the three themes where he speaks. The vendor report
writes universal buyer language ("buyers consistently", "uniformly viewed") over this base
without disclosure. Every strategic conclusion below is therefore tagged by evidence tier.

### What survives (act on it)

1. **Proof artifacts gate trust — and it is a marketing-surface bug, not a product gap.**
   Near-universal in the synthetic cohort (~40/40 demand proof; ~37 in auditor language) and
   the highest-leverage finding in the corpus once you notice: Caisson already ships every
   artifact demanded (OSCAL conformance CI, threat models, test coverage, WORM live proofs,
   the standards-gate) — none of it is surfaced on caisson.sh. An **evidence-pack page** is
   the cheapest, highest-ROI action in the whole study. (Synthetic-only tier, but the action
   is cheap and directionally safe.)
2. **The 12-month cliff is the largest objection cluster and it is terms-owned, not
   feature-owned.** Continuity/post-12-month clarity dominates (25 of 40 synthetics), gates
   the _initial_ sale, and is fully answerable with existing assets: perpetual-source-you-keep
   terms + the optional renewal framed as **security-patch continuity** ("your patches keep
   coming"), surfaced on the pricing page and the live dashboard updates-window that already
   shipped. The sharpest data point: a persona whose prior vendor "couldn't guarantee security
   patch delivery after the first year" — so they built in-house. That is Caisson's exact
   pricing shape; the copy must pre-empt it.
3. **Integration fit is where deals actually die.** Co-largest cluster (22/40) and the only
   one with lived scar tissue (~6 personas walked from real products over ORM/data-model/auth
   mismatches). Neutralizers already exist in the catalog: the Drizzle/Prisma bridges, base
   adapters, BYO providers, interactive create-caisson — they need a "does it fit my stack"
   adapter matrix + runnable demo/trial path, not new engineering.
4. **Renewal is a retrospective ROI decision, never assumed opex.** Universal in the
   synthetics, zero pushback on the 40%/X9 ratio itself. Frame the Developer plan as
   abandonware insurance; avoid any copy that reads "updates stop at 12 months unless you
   pay."

### What falls (do not carry into decisions)

1. **Theme 2's maturity/agency causal axis is fabricated.** 0/45 interviews tie architecture
   preference to team maturity; five mature in-house-built orgs picked platform (the inverse),
   and agencies split 2 modular / 3 platform / 1 hybrid against the report's "agencies reject
   the substrate in every scenario". The modular-vs-platform _polarization_ is real; its
   claimed cause is not. Positioning decisions should not use the maturity axis.
2. **"$1,049 reads as an extreme bargain" is manufactured.** The raw reactions are hedged
   "seems reasonable, if…" (~25/40) and needs-justification (~15/40); zero bargain language,
   zero price resistance — and the only real buyer to react called pricing "a nonnegotiable
   blocker" (n=1, and the critic notes the phrase was interviewer-scaffolded — caution, not
   conclusion).
3. **OSCAL salience is likely synthetic hallucination.** 26 synthetic user-turn mentions,
   zero real mentions — including two humans who live in ISO 27001/PCI audits daily. Same for
   "WORM" as vocabulary (39/40 synthetics, 0/5 reals — the reals describe the concept in
   plain English). Keep shipping OSCAL (it costs nothing to keep), but do not build demand
   forecasts on it.
4. **The "sophisticated builder" ICP portrait is contradicted by the humans.** All five reals
   outsource, buy GRC SaaS, or disclaim the layer; none hand-builds the WORM+KMS+RLS stack the
   synthetics uniformly claim. The real buyer's mental model may be "build the discipline in"
   (evidence as a byproduct of good practices), which is a headwind for "buy a bundle".

### What the lenses missed (critic findings — new work)

1. **Social proof is the study's biggest under-counted gate: ~31/40 synthetics demand case
   studies/testimonials/references — and it is the one gate Caisson cannot satisfy
   pre-launch.** Interim levers: the Apache-2.0 open Base as peer-reviewable proof, public
   changelog, founder-transparency positioning. Flag as the top open go-to-market risk.
2. **Support responsiveness is a distinct axis** (~19–39/40 depending on strictness) that the
   abandonware/renewal frame does not fully answer — buyers gate on _someone answers when it
   breaks_, separately from patch entitlement.
3. **Trial/sandbox/PoC access (~11/40)** is the most concrete de-risking ask and directly
   answers the highest-severity integration veto.

### Fork guidance (D2 / D3)

- **D2 (price tuning): hold the anchor; do not discount.** Zero price resistance in 40
  synthetic reactions, every WTP proxy (3–6 month internal builds, ~$15k quotes) far above
  $1,049, and latent too-cheap-to-trust skepticism ("silver bullet… skepticism") argues the
  binding constraint is proof + terms, not level. Weak synthetic-only evidence of headroom
  above — do not raise on it alone.
- **D3 (renewal framing): the 40%/X9 ratio is not the problem; the 12-month ambiguity is.**
  Answer "what happens after 12 months?" on the pricing page itself; frame renewal as
  security-patch continuity.
- **Data gaps before locking either fork:** no real buyer ever reacted to the actual anchor;
  no à-la-carte module-price reactions exist anywhere in the corpus; the two quant legs
  (frame test 776545, Van Westendorp 445432) are still filling. **Recommended follow-up: a
  ≥5-interview real-ICP qual round whose guide reaches the pricing screen and packaging fork**
  — the current human panel never did, so the commercial claims remain human-untested.

### Corrections applied (accuracy critic)

The critic verified 25+ load-bearing claims against raw text: quotes and real-vs-synthetic
attributions are overwhelmingly accurate. One hard error found and corrected below: the
objections lens claimed 44 extractions with one missing — there are 45 (40 synthetic + 5
real); its /44 ratios should be read against a 40-synthetic base. Two minor attribution notes:
`real-019f3b34`'s "nonnegotiable blocker" phrase was supplied by the interviewer's question
(the buyer filled it with "pricing"), and the Theme-2 architecture tallies
(14/15/6/10) are directional, not independently reproduced.

---

# Lens 1 — Theme validation vs the vendor report

Read both. Verdicts below, judged against the 45 labeled extractions (40 synthetic personas, 5 real humans). Citations are file basenames.

---

# Theme validation: Cookiy combined-round report vs. 45 raw extractions

## Master caveat that the vendor report never states in its themes

The three executive themes are written in universal human-panel language — "buyers consistently," "uniformly viewed," "overwhelmingly tired," "ruthlessly veto" — but **40 of 45 interviews are synthetic personas and 5 are real humans, and the 5 humans contribute essentially nothing to any of the three purchase-behavior themes.** Four real interviews (`real-019f3b04`, `real-019f3b06`, `real-019f3b4b`, `real-019f3b6f`) never reached a product pitch, price screen, or architecture question at all — they are generic current-state GRC/audit discovery that stops before the Caisson-relevant portion. The fifth (`real-019f3b34`) is the only human who reacted to the one-time-bundle concept, and it cuts _against_ the report (see Themes 1 and 3). So every headline theme rests on synthetic output, which the extractions repeatedly flag as "generic/hedged/templated," "mirrors the interviewer's framing," and "restates the question back" — i.e., at material risk of reflecting the pitch's own framing rather than independent buyer signal. The report's own evidence section surfaces only ~2 quotes traceable to the human panel ([A]-tagged: the "client-side events can be blocked" and "break-glass surprise contract" quotes), and both are current-state war stories, not theme-bearing.

---

## Theme 1 — "Auditor-ready proof artifacts are a trust/adoption precondition; missing artifacts trigger a security veto"

**Verdict: CONFIRMED (on synthetic data only), with two inflation caveats.**

**Substantiating count:** 40/40 synthetic interviews that reached the pitch named proof/documentation as a purchase precondition or blocker. Of those, **~37 named specifically auditor-language artifacts** (threat models, OSCAL mappings, test-coverage reports, security-review notes, design docs, compliance mappings). **0/5 real interviews substantiate it.**

Strongest verbatim support:

- "Lack of proof artifacts or misaligned compliance claims would block a purchase. If we can't verify security through documentation, it's a non-starter, regardless of code quality." — `syn-019f3af3-5cf8`
- "I'd need detailed proof artifacts, including a threat model, design documents, and security review notes. Additionally, compliance mappings and test coverage reports..." — `syn-019f3af2-41cc`
- "Trust would hinge on transparency. I'd need access to detailed proof artifacts: design docs, audit logs, and internal reviews." — `syn-019f3af1-8a54`
- "Intriguing, but only if it's built like production code—complete with tests, migrations, and failure handling." — `syn-019f3afa-618b`

**Disconfirming evidence (all of it):**

1. **The one real buyer who saw the pitch did not gate on proof artifacts at all.** `real-019f3b34` (CTO of a security-software company) named _price_ and _contract flexibility_ as the blockers — "pricing would be a nonnegotiable blocker" — and never mentioned threat models, OSCAL, test coverage, or source access. This is the single strongest human data point on the theme and it is a null.
2. **Three synthetic personas gave only generic SaaS trust signals, not auditor-language artifacts** — partial disconfirmation of the "auditor _language_" specificity: `syn-019f3af8-e969` (a literal Compliance Program Manager — the ideal auditor-language buyer — asked only for "case studies or testimonials," docs, and a trial); `syn-019f3afa-619a` (produces OSCAL in his own job but never demanded it of the vendor); `syn-019f3afb-9e97` (Principal Engineer whose demanded proof was generic dev-tool vetting — docs, integration examples, changelogs, peer reviews — the extraction rates the theme only "weakly supported" here).
3. **OSCAL appetite is not universal.** `syn-019f3af8-e973`: "We rarely rely on formats like OSCAL unless they integrate seamlessly with what we have." The report's "strong, validated appetite for automated OSCAL exports" overstates a signal that is lukewarm-to-cool in at least two interviews.

**Vendor-synthesis inflation:**

- **"Immediate and irreversible veto from the security branch of the buying committee"** is fabricated intensity. The raw data shows _conditional, remediable, self-authored_ criteria ("I'd need X before considering it") voiced by personas who _are themselves_ the security/compliance lead — not a separate security branch irrevocably overriding a purchase. No persona described the veto as irreversible; most framed missing proof as a gate to clear, not a permanent kill.
- **"Buyers immediately view the price point as an extreme bargain"** — no buyer said this. Synthetic personas said tepid, hedged "seems reasonable, but I'd need to evaluate…"; the one real buyer called pricing a "nonnegotiable blocker." "Extreme bargain" is enthusiasm manufactured out of hedges.

---

## Theme 2 — "Architectural preservation vs. operational overhaul: modular demanded by mature teams/agencies, platform preferred by greenfield leaders"

**Verdict: NOT SUPPORTED (as stated). The modular/platform polarization is real; the maturity/agency causal mapping is fabricated and partly contradicted.**

**Substantiating count for the maturity-correlation specifically: 0/45.** Not one interview ties architecture preference to team maturity. Where a modular preference is justified, the stated reason is _role/scope_ ("I'm primarily focused on auditable components, not full production features" — `syn-019f3af3-5cf8`) or _complexity-avoidance_, never "because we're a mature team." Nearly every extraction explicitly notes "(b) not tied to team maturity" or "not testable from one interview."

**Raw preference split** (real polarization exists, but roughly even — not a clean maturity bimodal): 14 modular, 15 platform, 6 hybrid, 10 unclear.

**Disconfirming evidence (all of it):**

1. **Mature, established, in-house-built orgs repeatedly chose PLATFORM — the opposite of "mature → modular":** `syn-019f3af2-41de` (mature banking-compliance org → full substrate), `syn-019f3af4-284a` (healthcare-staffing, built in-house → platform), `syn-019f3af9-a71a` (Lisbon fintech, built audit trail in-house → platform), `syn-019f3afa-6197` (insurtech, built tenant-isolation lib in-house → platform), `syn-019f3afb-9e8d` (mature in-house healthcare stack → platform). Five clear mature-org platform picks.
2. **"Agencies and consultancies consistently reject the full production substrate in every scenario" is directly contradicted.** Of the six agency/consultancy/studio personas: `syn-019f3af1-8a5f` modular ✓ and `syn-019f3afb-9e83` modular ✓ — but `syn-019f3af3-5cf4` (fintech-integrations consultancy) → **platform**, `syn-019f3afb-9e8e` (~90-person agency) → **platform**, `syn-019f3afb-9e97` (product studio) → **platform**, and `syn-019f3af3-5cff` (Miami agency) → **hybrid, wants the full substrate AND the bundle**. "In every scenario" is false; agencies split 2 modular / 3 platform / 1 hybrid.
3. **The small-team modular signal inverts the vendor's direction.** Small/early teams that preferred modular (`syn-019f3af3-5cfe`, `syn-019f3af8-e969`, `syn-019f3af9-a6fc`) did so for _bandwidth/complexity_ reasons — and they are the _less_ mature teams, yet they chose modular, which is the opposite of "mature → modular."

The one defensible piece the report can keep: a genuine _polarization_ between "surgical compliance bundle" and "unified full substrate" exists (well-cited both ways: `syn-019f3af1-8a5b` modular vs. `syn-019f3af2-41de` platform). But the axis explaining it — team maturity, with agencies always on the modular pole — is not in the data.

---

## Theme 3 — "Abandonware fear governs perpetual-license perception; the $499/yr renewal is a retrospective year-1 ROI decision"

**Verdict: CONFIRMED for the retrospective-renewal sub-claim (very strong); PARTIAL/overstated for the abandonware sub-claim.**

**Retrospective-ROI renewal — substantiating count: ~38/40 synthetic** (every synthetic that reached pricing framed renewal as a conditional look-back, not auto-renew). **0/5 real** (only `real-019f3b34` reached pricing, and framed it differently). This is the best-supported finding in the entire study.

- "I'd assess the update frequency, relevance of new features, and overall impact… If the updates consistently add value and ease the audit process, the continued cost would likely be justified." — `syn-019f3af1-8a48`
- "If it continues saving us equivalent to or more than hiring costs, renewing could be justified." — `syn-019f3af4-2859`
- "Otherwise, self-maintenance might be an option." — `syn-019f3af2-41d8`

**Abandonware fear — substantiating count: central/explicit in ~2** (`syn-019f3afb-9e94`, where abandonware is _the_ first unprompted objection and the reason they build in-house; `syn-019f3afb-9e97`, scarred by an unsupported starter kit), **abandonware-adjacent "what happens post-12-months / support-continuity" concern in ~12–15 more** (`syn-019f3af1-8a5a`, `syn-019f3af3-5cf4`, `syn-019f3af4-2842`, `syn-019f3af8-e972`, `syn-019f3af9-a71a`, `syn-019f3afb-9e8e`, `syn-019f3af3-5cf7`/`5cfe`, et al.). So the fear is real and recurring — but not the near-universal governing force the report implies.

**Disconfirming / complicating evidence (all of it):**

1. **A real buyer preferred _flexibility over_ a one-time lock-in — the inverse of the report's "perpetual is attractive" framing.** `real-019f3b34`: "we wouldn't like to be tied into a specific one-time contract… we'd like the flexibility to move and adapt," and pricing was a "nonnegotiable blocker." The only human pricing reaction pushes back on the perpetual model's appeal.
2. **Redistribution-rights veto is thin.** The report claims legal/procurement "ruthlessly veto contracts that introduce any licensing ambiguity." Redistribution-rights specifically appears in ~2 interviews (`syn-019f3af8-e972` "legal team would likely veto… around redistribution rights"; license-restriction-as-blocker in `syn-019f3af2-41cc`); general licensing-ambiguity-as-blocker in ~7. "Ruthlessly veto _any_ ambiguity" is inflated from a handful of conditional mentions.

**Vendor-synthesis inflation:**

- **Conflation of "will I keep getting updates" with "will the code brick."** The report demands "explicit guarantees that the software remains fully functional even without ongoing payments." Almost all raw mentions are about _update/patch entitlement clarity post-12-months_, not fear the code stops working. Only the two true-abandonware personas raise functionality-continuity; the report generalizes an entitlement-clarity concern into a bricking fear.
- **"Uniformly viewed as highly competitive" / "openly acknowledge it is drastically cheaper than an internal sprint"** — synthetic personas said "seems reasonable" conditioned on proof and support; the cost-vs-build comparison was volunteered by only some, and no real buyer endorsed it.

---

## Cross-cutting vendor inflations (summary for the doc)

1. **Synthetic/real provenance is laundered.** Universal human-panel language over 40 synthetic personas + 5 non-contributing humans; the personas are flagged as templated and interviewer-mirroring, so the study partly measures its own pitch reflected back.
2. **Hedges upgraded to enthusiasm.** "Seems reasonable, but…" → "extreme bargain," "uniformly competitive."
3. **Conditional self-criteria upgraded to institutional vetoes.** "I'd need X before considering" → "immediate and irreversible veto from the security branch."
4. **A fabricated causal axis.** Theme 2's team-maturity/agency split has zero direct support and is contradicted by 5 mature-org platform picks and 3–4 agency platform/hybrid picks.
5. **Entitlement-clarity dressed as bricking fear** in Theme 3.

**Net:** Theme 1 core (proof artifacts gate trust) and Theme 3's renewal-as-ROI are genuinely load-bearing — but only in the synthetic cohort, and stripped of the invented veto/bargain intensity. Theme 2 as written should not be carried into positioning decisions; the modular-vs-platform polarization is real, its stated cause is not.

---

# Lens 2 — Synthetic-vs-human delta

# Synthetic-vs-Human Delta

**One-line finding:** the study's commercial thesis rests on **40 archetype-perfect synthetic personas and effectively ~0.5 real data points.** Four of the five real humans never reached a product, price, packaging, or buy-vs-build question at all; the fifth reached only a concept sketch with **no price anchor**. Every headline number and preference in the study is therefore synthetic-derived, and on the handful of axes where a real human _did_ speak, they diverge from — and in two places contradict — the synthetic consensus.

## 1. The coverage gap (the delta that dwarfs all others)

|                                                      | Synthetics (n=40) | Reals (n=5)             |
| ---------------------------------------------------- | ----------------- | ----------------------- |
| Heard the $1,049 / $499 price                        | 40                | **0**                   |
| Reached the product concept at all                   | 40                | **1** (`real-019f3b34`) |
| Reached the bundle-vs-substrate architecture Q       | 40                | **0**                   |
| Asked "what proof would make you _buy_"              | 40                | **0**                   |
| Gave a buy-vs-build call on a _TS compliance bundle_ | 40                | **0**                   |

The four reals that never reached product weren't refusals — the interview guide simply never pivoted. `real-019f3b06` hit the wrap-up mid-encryption ("_Quick time check—we're getting close_"); `real-019f3b04` and `real-019f3b6f` stayed in current-state discovery through the closing bell; `real-019f3b4b` got an off-topic quality warning early, recovered, and the session ended right after the tenant-isolation question. **Claims (a) proof-artifacts-as-purchase-precondition, (b) modular-vs-platform-by-maturity, and (c) renewal-as-year-1-ROI have literally zero real-human test in this corpus.**

## 2. Population mismatch — the reals aren't the ICP

The 40 synthetics are 40 copies of one person: a CTO/VP-Eng/Security-Lead at a regulated SaaS who personally hand-built WORM + field-level KMS encryption + tenant isolation + OSCAL exports and speaks fluent auditor. The five reals are a different, mostly **off-ICP** crowd:

- `real-019f3b04` — healthcare **vendor-risk/GRC contractor**, not an engineer. Stack: Whistic, Hyperproof, Risk Recon. Would never buy a TypeScript module.
- `real-019f3b06` — **finance ops/compliance**, disclaims building three times: "_I am not directly responsible for building the product or implementing the technical logging layer._"
- `real-019f3b34` — security-software **VP/CTO** (closest to ICP) but has **outsourced** encryption to Trend Micro and infra to Oracle Cloud.
- `real-019f3b4b` — **frontend engineer**, SOC 2 point person, explicitly not the backend/crypto owner.
- `real-019f3b6f` — payments-MSP **technical manager**; stack is Netwrix + Azure Key Vault + M365 DLP.

**No real human is "a founder/CTO deciding whether to embed a bought TS compliance bundle in their own product."** The synthetic-vs-human comparison is thus confounded: the humans mostly disagree by _not being asked_ and _not being the buyer_, not by contesting answers.

## 3. Six divergence axes where reals _did_ speak

**a) Vocabulary — the synthetic tells.** ~25 of 40 synthetics volunteer "**OSCAL**" as current-state fact; **0 of 5 reals** say it — including two who live in ISO 27001 / PCI-DSS / Cyber Essentials audits daily. ~40 of 40 synthetics say "**WORM**" in their first sentence; **0 of 5 reals** use the term — they describe the concept in plain English: "_It would just automatically go somewhere and stay so that it's unable to be accessed by anybody… [un]tampered with_" (`real-019f3b6f`). OSCAL and "WORM" read as **synthetic-salient jargon**, not practitioner language.

**b) Hands-on ownership.** ~40 of 40 synthetics personally implement field-level encryption with per-field keys and rotation. **0 of 5 reals do:** `real-019f3b34` outsources it ("_signed the contract with Trend Micro… as an external vendor_"), `real-019f3b6f` leans on Azure Key Vault RBAC, and `real-019f3b4b` refuses to claim it: "_field-level encryption and key management sits on the back end… I've never implemented it myself… either one should be a red flag._" The synthetic ICP's uniform hands-on ownership is a fiction.

**c) Epistemic hedging.** **3 of 5 reals** explicitly disclaim a domain ("_That actually is not in my specifics wheelhouse_" — `real-019f3b04`; "_I sure do clarify that I wasn't the technical owner_" — `real-019f3b06`). **0 of 40 synthetics** ever say "not my area" — every synthetic answers every question with equal fluency. **2 of 5 reals** cite NDA/confidentiality as a limiter; **0 synthetics** do. Real transcripts have role boundaries and refusals; synthetic ones invent freely.

**d) Tool-naming.** **5 of 5 reals** name concrete commercial products for their _own compliance stack_ (Hyperproof, Whistic, Risk Recon, Netwrix, Azure Key Vault, Trend Micro, Oracle, Okta, M365 DLP). Synthetics almost never name a product for the compliance stack — it's always generic ("_a secure key management service_"). Synthetics only name real tools for the **contrast dev-tool purchase** (SonarQube, JFrog Xray, HashiCorp Vault, Datadog, Terraform) — a suspiciously consistent "_I do buy tools, see_" rhetorical move.

**e) Price.** The one real who saw the concept, with **no number quoted**, named price the top blocker: "_pricing would be a nonnegotiable blocker._" This inverts the synthetic chorus that "$1,049 seems reasonable" with hesitation only about _update terms_.

**f) One-time model.** Same real rejected the perpetual frame as lock-in: "_we wouldn't like to be tied into a specific onetime contract… we'd like the flexibility to move and adapt._" Several synthetics call the one-time bundle a _convenience_ ("_prefers a one-time fee_"). The lone real read it as a _risk_.

## 4. Findings rating

| #                  | Study finding                                                                                                    | Rating                                              | Basis                                                                                                                                                                                                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1                 | Auditor-language proof artifacts (threat models, OSCAL, test coverage) are a **purchase precondition** (claim a) | **Synthetic-only** (vocabulary weakly contradicted) | 0 reals asked; the trust criteria reals _did_ give were process-adherence & operational evidence, not the artifact list — "_whether or not they follow the specific issue management item that we agreed upon_" (`real-019f3b04`); "_evidence as a byproduct of good practices_" (`real-019f3b4b`). No real says OSCAL/threat-model as a buying gate. |
| F2                 | $1,049 / $499 **price is accepted**; hesitation is about terms, not level                                        | **Synthetic-only + contradicted (n=1)**             | 0 reals heard the numbers; the one real who saw the concept made price the #1 blocker with no anchor.                                                                                                                                                                                                                                                 |
| F3                 | Renewal is a **retrospective ROI** call, not auto-opex (claim c)                                                 | **Synthetic-only** (directionally plausible)        | 0 reals reached renewal; `real-019f3b34`'s anti-lock-in instinct is loosely consistent.                                                                                                                                                                                                                                                               |
| F4                 | Buyers prefer a **modular compliance bundle**, split by team maturity (claim b)                                  | **Synthetic-only, and internally unsupported**      | 0 reals reached it; even the synthetics never tie the split to maturity (extractions repeatedly say "not addressed").                                                                                                                                                                                                                                 |
| F5                 | The ICP **already runs WORM + field-encryption + KMS + OSCAL in-house** ("sophisticated builder")                | **Contradicted by humans**                          | Real practitioners **outsource** encryption (Trend Micro), **buy** GRC SaaS (Hyperproof, Netwrix), or **disclaim** the layer. 0/5 hand-build the full stack.                                                                                                                                                                                          |
| F6                 | Buy-vs-build turns on integration fit; **abandonware / lock-in / licensing clarity** are recurring blockers      | **Partially human-corroborated**                    | `real-019f3b34` independently voices the lock-in worry ("_flexibility to move and adapt_") — the single strongest real→synthetic corroboration. But reals' actual posture is buy-commercial-SaaS, not build.                                                                                                                                          |
| F7                 | **OSCAL export** is a valued/expected capability                                                                 | **Synthetic-only — likely hallucinated salience**   | 0/5 reals mention OSCAL, including ISO/PCI shops where it would surface if real.                                                                                                                                                                                                                                                                      |
| F8                 | A **one-time source bundle is attractive** (consolidation, no recurring fees)                                    | **Contradicted by humans (n=1)**                    | The only real to react read one-time as _lock-in risk_, not convenience.                                                                                                                                                                                                                                                                              |
| F9 (problem space) | Immutable/tamper-proof audit logs + reducing manual evidence-chasing is a **real, felt pain**                    | **Human-corroborated**                              | See §6.                                                                                                                                                                                                                                                                                                                                               |

## 5. Discount these synthetic-derived claims

1. **The proof-artifact buying-gate vocabulary** (OSCAL / threat-model / test-coverage as _purchase preconditions_). Discount as synthetic jargon echo — real trust criteria are process- and operations-shaped, and no real reached the buying-gate question.
2. **"$1,049 seems reasonable" as validated WTP.** It's LLM agreeableness (every synthetic hedges _up_, never pushes back on the number). Zero real anchoring; the one real signal points the other way. **Do not treat the synthetic price-acceptance as WTP evidence.**
3. **The "everyone builds in-house" ICP portrait** (F5). Reals buy/outsource. The build-first narrative is a synthetic uniformity artifact.
4. **OSCAL as a demand driver** (F7). Hardest discount — a vocabulary that appears in >half the synthetics and none of the humans.
5. **Maturity-based architecture split** (claim b / F4). Unsupported even inside the synthetic set.

## 6. What the reals independently CONFIRM

The **problem space** survives, even though the solution/commerce doesn't:

- **Immutable, tamper-evident audit logs are a genuine want.** `real-019f3b6f` on the ideal: "_just automatically go somewhere and stay so that it's unable to be accessed… [un]tampered with._" `real-019f3b04` affirmed automated log-integrity proof "_would make my job a lot easier… a lot of this is just clerical work._"
- **Fragmented evidence / manual chasing is the real pain** — the consolidation value prop has human support. `real-019f3b06`: "_the main issue wasn't a missing control, but fragmented documentation… we could immediately see what was complete, what was missing._" `real-019f3b04` describes chasing artifacts into Hyperproof by deadline.
- **Continuity/lock-in anxiety** around a bought bundle (F6) — the one place a real echoes the synthetic abandonware theme.
- **But the buyer's mental model may be architectural, not procurement:** `real-019f3b4b`'s thesis — "_audits are painless if we treat evidence as a byproduct of good practices, not something you scramble to produce_" — reframes the win as _build the discipline in_, which is a headwind for "buy a bundle," not a tailwind.

## 7. Methodological caveat

The contradictions in F2/F8 are **n=1** — directional, not conclusive; flag them as _unverified against the real population_ rather than _disproven_. The deeper problem is structural: **2 of 5 reals were off-ICP** (a GRC contractor, a finance-ops reviewer), **1 got a quality warning**, and the guide **pivoted to product for only 1 of 5**. So the corpus cannot answer "do real buyers agree?" — it can only establish that **the study has not yet put its commercial claims in front of a single real ICP buyer with a real price.** Before shipping strategy on F1–F4, F7, run ≥5 real interviews with the actual buyer persona that reach the pricing screen and the packaging fork.

**Raw transcripts:** `/tmp/claude-1000/-home-gw-lab-caisson/74796f33-b974-40a0-8744-fd455ec9805b/scratchpad/playbacks/real-019f3b{04,06,34,4b,6f}-*.json`

---

# Lens 3 — Pricing / WTP (D2 and D3)

# Pricing / WTP Lens — 45 Interview Extractions

## Reading the sample before the numbers (binding caveat)

Only **40 of 45** extractions were ever shown the actual anchors ($1,049 one-time / $499-per-yr / ~40% renewal) — and **all 40 are synthetic personas** (`kind: synthetic`). Of the **5 real interviews**, four (`real-019f3b04`, `real-019f3b06`, `real-019f3b4b`, `real-019f3b6f`) never reached a pricing screen at all (generic compliance-workflow discovery that ran out of scope/time), and the fifth (`real-019f3b34`) discussed price _conceptually with no dollar figure presented_. So the entire price-reaction distribution below is synthetic-persona data — directional only, and the responses are near-monolithic in a way ("reasonable, but I'd need to evaluate ongoing value…") that is itself a known synthetic-persona tell. **The one real price signal we have points a different, more cautious direction than the synthetic chorus** (see below). Treat the synthetic uniformity as weak evidence and weight the single real data point heavily.

## Distribution of price reactions (n=40 synthetic, anchor shown)

| Bucket                  | Count      | What it looks like                                                                                                                                                                                                                                                                                     |
| ----------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **bargain**             | 0 explicit | Warmest was `syn-019f3afa-618b`: "$1,049 seems reasonable… **within the range we typically consider for tools like this**" — comfortable accept, not a steal.                                                                                                                                          |
| **fair**                | ~25        | "The pricing seems reasonable… with 12 months of updates" (`syn-019f3af1-8a54`); "reasonable for niche compliance tools, especially with a year of updates" (`syn-019f3af2-41c9`); "That price seems **fair**, provided it delivers" (`syn-019f3afb-9e83`). Number accepted on ordinary due-diligence. |
| **needs-justification** | ~15        | Price explicitly gated on ROI-vs-build / budget: "compare it to potential internal development time" (`syn-019f3af8-e96a`); "justify the cost against our potential savings" (`syn-019f3af4-2859`); "Value needs to extend beyond just the first 12 months" (`syn-019f3afb-9e97`, hedged hardest).     |
| **too-cheap-to-trust**  | 0 verbatim | No persona called it suspiciously cheap — but the structural condition exists (next section).                                                                                                                                                                                                          |

**Zero personas — synthetic or real — said the price was too high.** The friction is uniformly about _ongoing value, updates, support, and abandonware_, never the one-time number's level.

## Too-cheap-to-trust signal

No verbatim "that's too cheap." But the anchor sits **1–2 orders of magnitude below every buyer's own stated build cost** for the same four capabilities (WORM + field-crypto + tenant isolation + OSCAL):

- `syn-019f3af8-e96a`: built it in-house at "three engineer-weeks, **roughly $15,000**."
- `syn-019f3af1-8a48`: "around **six months** in development time."
- `syn-019f3af1-8a5b`, `syn-019f3af8-e974`, `syn-019f3af8-e975`: "**three-month** cycle with **two engineers**."

Against a $15k–$150k internal build, $1,049 is 1–7% of cost. That gap co-occurs with the sample's most common _gut_ reaction being **skepticism about engineering discipline**, not enthusiasm: "My first reaction would be **skepticism**. I'd need to evaluate their engineering discipline—test coverage, changelogs" (`syn-019f3af1-8a54`); "sounds like a **silver bullet—but in reality, skepticism**" (`syn-019f3af9-a6fc`); "A one-time source bundle? **I'd be skeptical**" (`syn-019f3afb-9e94`). The trivial price relative to serious claims is a latent credibility risk — the too-cheap-to-trust effect is showing up as "prove it's real," not "it's a bargain."

## WTP ceilings mentioned

Almost no persona named a WTP number. The recurring comparator is **internal build cost**, which every buyer places far above $1,049:

- Explicit acceptable-range statement: `syn-019f3afa-618b` — "$1,049… within the range we typically consider for tools like this."
- Build-cost proxies (all above the anchor): `syn-019f3af8-e96a` (~$15,000), plus the 3–6-month eng builds cited above.
- Adjacent tool spend: `syn-019f3af8-e96a` bought a monitoring tool "under $5k."
- **Only real price signal** (`real-019f3b34`, CTO of a gov-regulated security-software co): no ceiling number, but **price named as a hard blocker** — "pricing would be a **nonnegotiable blocker**… we are trying to keep costs as low due to the current economy," wants "the **lowest possible costs** for the best possible service." Prefers one-time over recurring on finance grounds ("the finance team would much prefer that… than the licensing or service costs you typically pay for platforms like Oracle") **but** refuses lock-in ("we wouldn't like to be tied into a specific onetime contract… we'd like the flexibility to move and adapt").

Net: every stated WTP proxy sits above $1,049; the single real buyer is cost-cautious and lock-in-averse but volunteers no number.

## Procurement thresholds (sign-off vs credit-card)

Even at ~$1,049, **not a single persona described this as a solo credit-card purchase.** Every buy is a committee: security lead + engineering + finance, frequently + legal/procurement + CTO. Named legal/licensing gates:

- `syn-019f3af8-e972`: "our **legal team would likely veto** the purchase" on redistribution-rights ambiguity.
- `syn-019f3af3-5cf4` (consultancy): "client's **account manager owns budget ceilings**," client compliance lead owns compliance sign-off.
- `syn-019f3af2-41c9`, `syn-019f3af4-2842`: "legal advisor for any **licensing** concerns" seated on the committee.

The compliance context drags even a sub-$1k purchase into procurement/legal review — the _price_ clears budget authority easily, but the _terms_ (licensing, redistribution, post-12mo support) do not clear review automatically.

## Renewal intent (D3 core)

Renewal is **universally retrospective and value-gated — never assumed opex.** Representative:

- "If the updates consistently add value and ease the audit process, the continued cost would likely be justified" (`syn-019f3af1-8a48`).
- "Otherwise, **self-maintenance** might be an option" (`syn-019f3af2-41d8`); "Otherwise, we'd weigh **in-house solutions or other vendors**" (`syn-019f3af3-5cf3`); "**maintaining internally could be cheaper**" (`syn-019f3af4-284a`).
- The **40% / $499 ratio itself drew zero pushback** anywhere. The renewal number is not the problem.

The live anxiety is the **12-month cliff**, and it gates the _initial_ sale, not just renewal:

- "clear terms on **what happens post-12 months**" (`syn-019f3af4-2842`); "scrutinize what happens **after 12 months**" (`syn-019f3af8-e972`); "clarity on **update entitlements post-12 months**" (`syn-019f3af9-a71a`); "**assurance of its relevance beyond an initial year**… proof **it's not abandonware**" (`syn-019f3afb-9e94`).
- **Sharpest warning** — `syn-019f3af4-2842`'s own build-vs-buy story mirrors Caisson's exact structure: "When the vendor **couldn't guarantee security patch delivery after the first year**, it increased governance risks, **solidifying our choice to build internally**." The 12-month-then-renew shape reads like the precise pattern that made this buyer walk.

## Ranked pricing-page / copy changes the data supports

1. **Answer "what happens after 12 months?" on the pricing page itself, prominently.** Most-repeated concern in the sample; raised as purchase-_gating_, not just renewal-time. Make post-12-month **security-patch continuity** explicit. → **D3** (and unblocks D2 conversion). Cites: `syn-019f3af4-2842`, `syn-019f3af8-e972`, `syn-019f3af9-a71a`, `syn-019f3afb-9e97`, `syn-019f3af3-5cf3`, `syn-019f3af4-284a`, `syn-019f3af8-e974`.

2. **Reframe the $499/yr plan as security-patch / abandonware insurance, not "updates."** The one-time model triggers abandonware fear; the renewal plan is the answer to it. Position it as "your patches keep coming," directly defusing the `syn-019f3af4-2842` walk-away pattern. → **D3**. Cites: `syn-019f3afb-9e94`, `syn-019f3afb-9e97`, `syn-019f3af4-2842`.

3. **Anchor the price against internal build cost on-page ("~X engineer-months to build this yourself").** Buyers independently benchmark to their own 3–6-month / ~$15k builds; a build-vs-buy comparator both justifies the number and pre-empts the value-justification friction that dominates every reaction. → **D2** (supports holding/raising the anchor). Cites: `syn-019f3af8-e96a` ("$15,000"), `syn-019f3af4-284a`, `syn-019f3af4-2859`, `syn-019f3af1-8a48` ("six months").

4. **Put proof artifacts next to the price** (test coverage, threat model, changelog, OSCAL sample, security-review notes). The gate is trust, not price level — nearly every "reasonable _if_…" resolves on engineering-discipline proof. This is the highest-leverage conversion lever at the current anchor. → **D2**. Cites: `syn-019f3af1-8a54`, `syn-019f3af1-8a54`, `syn-019f3af8-e96a`, broad.

5. **Publish explicit licensing / redistribution terms + update-entitlement scope at checkout.** Licensing clarity is a named blocker and a legal-veto trigger even sub-$1k. → **D2/D3**. Cites: `syn-019f3af8-e972` (legal veto), `syn-019f3af3-5cf4` (licensing named 3×), `syn-019f3af4-2842` ("clear licensing terms" = swing factor).

6. **Keep selling the compliance bundle as a standalone SKU (don't force the full substrate).** Compliance-scoped buyers repeatedly prefer "just the compliance bundle" over the platform — the six-bundle rework already does this; data confirms it. Note: **à-la-carte module prices drew zero reactions in the entire sample** — a genuine data gap, not a validation. → **D2** (SKU structure). Cites: modular-preference personas `syn-019f3af1-8a5b`, `syn-019f3af8-e96a`, `syn-019f3afb-9e83`.

7. **Offer trial / sandbox access as a price de-risker.** Repeatedly requested before commit; lowers the perceived risk that gates the "reasonable if it works" reaction. → **D2** conversion. Cites: `syn-019f3af9-a6fc`, `syn-019f3af8-e969`, `syn-019f3af4-2859` ("trial version"), `syn-019f3afb-9e83` ("trial access").

## Direct read on the open forks

**D2 (final price tuning):** Data supports **holding, not cutting, the $1,049 anchor** — zero price resistance across 40 synthetic reactions, every WTP proxy above it, and the only real objection (`real-019f3b34`) was about *recurring lock-in and general cost-consciousness*, not the one-time number. Weak evidence of **headroom above** $1,049 (build-cost gap + latent too-cheap-to-trust skepticism), but that inference rests on synthetic data — don't raise on it alone. The binding conversion constraint is **not price level**; it's proof + post-12-month terms. Spend D2 tuning budget there, not on discounting.

**D3 (renewal / updates framing):** The **40% / $499 ratio is not the problem — the 12-month ambiguity is.** Renewal is a retrospective value call for every buyer, and the cliff creates abandonware/security-patch anxiety that suppresses the _initial_ sale. Frame the renewal explicitly as **continued security-patch delivery** (the exact guarantee whose absence made `syn-019f3af4-2842` build in-house), surface it on the pricing page rather than post-purchase, and avoid any copy that reads as "updates stop at 12 months unless you pay."

**Data gaps to flag for the operator:** (1) no real buyer ever reacted to the actual anchor; (2) no à-la-carte module-price reactions exist in the corpus; (3) the synthetic uniformity ("reasonable, but ongoing value…") should not be read as validated price acceptance.

---

# Lens 4 — Objection and veto taxonomy, mapped to owned surfaces

> **[Editor correction — accuracy critic]** The corpus note below is wrong: the corpus is 45 extractions (40 synthetic + 5 real); none is absent. Read every /44 ratio against a 40-synthetic base (41 counting the one real who reached the pitch).

# Objection & Veto Taxonomy → Neutralizing-Surface Map

**Corpus note (read first).** The payload carries **44 extractions** (5 `real-*`, 39 `syn-*`); the brief names 45 — one appears absent. The taxonomy below is **~90% synthetic-derived**: of the 5 real interviews, **four raised zero purchase objections** because the interview never reached a pitch (`019f3b04`, `019f3b06`, `019f3b4b`, `019f3b6f` — generic GRC/audit-workflow discovery, no product, no price), and **the one real buyer who reacted inverts the synthetic pattern** (`019f3b34`: price was the _only_ hard veto, proof artifacts never mentioned). Treat every synthetic count as directional-consensus, not market-validated. Citations are basename fragments — the unique `019fxxxx-xxxx` id inside each `{real,syn}-019f…json` filename.

**Structural fact that shapes every fix:** ~30 synthetics name a **multi-stakeholder buying committee** (security lead + eng + finance, often + legal/CTO/compliance), so there is rarely a single veto-holder — the surface changes must clear all four gates **in parallel**. Legal/procurement is explicitly seated on the committee in ≥10 interviews (`af2-41c9`, `af2-41cc`, `af3-5cff`, `af4-2842`, `af8-e972`, `af8-e974`, `af9-a71a`, `af9-a701`, `af8-e96a`, `afb-9e8e`).

## Ranked action table

| #   | Objection cluster                                                        | Veto-holder                            | Count /44                                 | Severity                                                    | Neutralizing change                                                                                                                                                                        | Owning surface                                                                                          |
| --- | ------------------------------------------------------------------------ | -------------------------------------- | ----------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 1   | **Continuity / abandonware / post-12-mo support**                        | Legal-procurement + budget             | **25**                                    | Friction-dominant, ~6 hard                                  | Publish perpetual-use terms + optional-renewal + "source you keep forever, security patches during window, no lock-in"; expose the live updates-window in-dashboard                        | **EULA/license terms** + **buyer dashboard** (updates-window, ADR-0260 §5) + bundle-page continuity FAQ |
| 2   | **Insufficient proof artifacts / docs / evidence**                       | Security lead                          | **22**                                    | Hard (several "non-starter regardless of code")             | Surface the _already-shipped_ artifacts publicly as an evidence pack: OSCAL CI, threat models, test coverage, WORM live proofs, standards-gate                                             | **Shipped proof artifacts** + marketing **docs** / bundle+module pages                                  |
| 3   | **Integration / infra-assumption / data-model fit**                      | Eng lead                               | **22** (~6 lived scars)                   | Highest-severity friction (real lost deals)                 | Document stack-agnostic adapters (Drizzle/Prisma bridges, DB/auth adapters, BYO providers, "no hardcoded infra"); ship runnable demo + interactive `create-caisson` for week-one fit check | Marketing **module pages + docs** + **generator/demo**                                                  |
| 4   | **Compliance / regulatory non-alignment**                                | Security-compliance                    | **12**                                    | Hard ("non-negotiable")                                     | OSCAL conformance CI mapped to _named_ regimes (SOC2/HIPAA/FedRAMP/PCI/GDPR) + control-mapping crosswalks                                                                                  | **Shipped proof (OSCAL CI)** + **docs**                                                                 |
| 5   | **Licensing ambiguity / redistribution rights**                          | Legal-procurement                      | **9** (incl. the one explicit legal VETO) | Hard where present                                          | Unambiguous written terms: perpetual use, redistribution/sublicense scope, per-org seat scope, Apache-2.0 base vs commercial-module split (ADR-0094)                                       | **EULA/license terms** + marketing **license page**                                                     |
| 6   | **Workflow disruption / onboarding / operational overhead**              | Eng lead                               | **10**                                    | Friction                                                    | Interactive generator + deploy templates + demo as onboarding proof; runbook docs                                                                                                          | **Generator/demo** + **docs**                                                                           |
| 7   | **Cost / budget / TCO / hidden costs**                                   | Budget owner                           | **9**                                     | Hard only in the 1 real interview; synthetics accept $1,049 | TCO clarity line (renewal optional, no hidden costs) — _low priority; price is not the blocker_                                                                                            | Marketing **pricing/bundle pages**                                                                      |
| 8   | **Vendor credibility / financial stability / social proof**              | Security + procurement (due diligence) | **8**                                     | Hard ("regardless of code quality")                         | Case studies/testimonials/references — **genuine pre-launch gap**; interim substitute: open Apache base + public changelog + shipped-proof + founder transparency                          | Marketing **homepage / bundle pages** + **/affiliates**                                                 |
| 9   | **Production-readiness (tests, migrations, key-mgmt, failure handling)** | Eng lead                               | **7**                                     | Hard ("would stop us")                                      | Surface test-coverage + operational runbooks (migrations, key rotation, incident handling, upgrade diffing); migrate pkg + harness already ship                                            | **Docs** + **shipped proof (test coverage, standards-gate)**                                            |
| 10  | **Open-source / community-transparency expectation**                     | Eng/security trust                     | **5**                                     | Friction / model tension                                    | Lean on the Apache-2.0 open **Base** as peer-reviewable; state it plainly                                                                                                                  | Marketing **license/compare page** + EULA                                                               |
| 11  | **Ownership / lifecycle / "fragile project code" / forked liability**    | Eng lead                               | **4**                                     | Friction                                                    | Position as versioned, tested, upgrade-diffed platform component (not glue code); standards-gate + updates pipeline story                                                                  | **Docs** + **shipped proof (standards-gate)**                                                           |

## By veto-holder

**Security lead** (owns clusters 2, 4, 8, part of 9). The dominant gate. Proof artifacts are the near-universal precondition and the sharpest hard vetoes: "Lack of proof artifacts or misaligned compliance claims would block a purchase… non-starter, regardless of code quality" (`af3-5cf8`); "absence of credible documentation or proof artifacts would block a purchase" (`af9-a71b`); "insufficient proof of compliance effectiveness… could block" (`af1-8a48`); also `af1-8a54`, `af2-41cc`, `af2-41d8`, `af2-41de`, `af3-5cf4`, `af4-2842`, `af8-e96a`, `af8-e973`, `af8-e974`, `af9-a701`, `afa-6187`, `afb-9e83`, `afb-9e97`, `afa-619a`, `af8-e969`. **The strategic point: Caisson has already built every artifact these buyers demand** (OSCAL CI, threat models, test coverage, WORM live proofs, standards-gate) — the objection is a _surfacing_ failure, not a _capability_ gap. Cheapest high-leverage move in the whole table: an evidence-pack page on docs. Regulatory-alignment (cluster 4) is the same gate one layer up — buyers want the OSCAL mapping tied to _their named regime_ (FedRAMP specifically: `af4-2862`; SOC2/HIPAA/PCI/GDPR across `af5b`, `af2-41cc`, `af8-e973`, `af9-a701`, `afb-9e8e`). Financial-stability vetoes (cluster 8) are the one thing shipped artifacts can't fully answer — "concerns about vendor credibility and financial stability could block a purchase, regardless of code quality" (`af1-8a5b`) is unfixable pre-launch except via open-base transparency + honest founder positioning.

**Legal / procurement** (owns clusters 1, 5). Continuity is the single largest cluster (25/44) and it is legal/procurement-shaped because it's a _terms_ problem, not a product problem: the 12-mo-updates-then-renewal pricing structurally provokes "what happens after 12 months? How are security patches handled thereafter?" (`af4-2842`), "clarity on update entitlements post-12 months" (`af9-a71a`), "might risk becoming outdated without frequent updates and strong support" (`afa-6190`), and the purest case — a buyer whose prior vendor "couldn't guarantee security patch delivery after the first year, [so] we built internally" (`af4-2842`) and another whose reflexive first reaction to the bundle was "I'd need proof it's not abandonware" (`afb-9e94`). **This is neutralized by terms, not features:** the perpetual-source-you-keep story + optional renewal + the live in-dashboard updates-window (already shipped, ADR-0260 §5) directly answers "it can't strand us — we own the source." Licensing (cluster 5) carries the corpus's **single most explicit hard veto**: "Contract ambiguity could block it, especially around redistribution rights… our legal team would likely veto the purchase" (`af8-e972`), echoed by `af3-5cf4` (a past licensing delay drives the whole transcript), `af2-41cc`, `af4-2842`, `af4-284a`, `af8-e974`, `afb-9e8e`. Fix is written EULA clarity on redistribution/seat scope + the Apache-base-vs-commercial split.

**Eng lead** (owns clusters 3, 6, 9, 11). Integration is co-equal-largest (22/44) and the **highest-severity friction in the corpus because ~6 buyers have lived exactly this failure** and it's why they build instead of buy: Postgres-lib-vs-MySQL-client three-day detour (`af3-5cff`, whose dominant evaluation lens became "check for infrastructure assumptions—or if it's too rigid"); ORM-mismatch starter kit scrapped over a weekend (`af9-a6fc`); "compliance export package… assumed a different data model" → built own (`afb-9e8e`); HIPAA starter kit "conflicted with our RBAC model" → built in-house (`afb-9e83`, `af9-a71b`); auth-provider-mismatch abandonment (`af8-e969`). For this cluster the neutralizer is not copy — it's the **shipped adapter surface** (Drizzle/Prisma bridges ADR-0266, base adapters, BYO providers) documented on module pages **plus a runnable demo / interactive generator** so the buyer proves fit in week one (the exact ask: "a trial version to test compatibility" `af8-e969`, "sandbox testing before adoption" `afa-619a`, "hands-on trial or prototype access" `afb-9e83`). Production-readiness (cluster 9) is a hard gate for the ICs: "built like production code—complete with tests, migrations, and failure handling. Anything less might look attractive but ultimately fall short" (`afa-618b`); "lack of operational guidance or unclear key management protocols would stop us" (`afb-9e8d`); "test harness… upgrade diffing… otherwise it risks becoming a costly forked liability" (`af4-284a`).

**Budget owner** (owns cluster 7). **The most important negative finding in the dataset.** Across 39 synthetics, ~all react to $1,049 with "seems reasonable" and push back only on *continuity/proof/integration*, never the number — e.g. "A one-time price of $1,049 seems reasonable, especially with 12 months of updates included, provided the solution meets our performance and integration needs" (`afa-618b`). The **only hard price veto in the corpus is the single real buyer**: "pricing would be a nonnegotiable blocker… we are trying to keep costs as low [as possible] due to the current economy," who _also_ resisted one-time lock-in and never once asked for a threat model or OSCAL mapping (`019f3b34`). So: do **not** spend surface budget discounting; spend it on continuity terms and proof surfacing. The one real-buyer signal is a caution that the synthetic price-insensitivity may be optimistic — worth a live pricing test before over-trusting it.

## Cross-cutting notes for the doc

- **The proof-artifact veto is a marketing-surface bug, not a product gap.** Caisson ships OSCAL conformance CI, threat models, test coverage, WORM live proofs, and the standards-gate; 22 interviews demand exactly these; they are not surfaced on caisson.sh. Highest ROI action in the table.
- **Continuity + licensing (clusters 1 + 5 = 34 interview-hits combined) are both EULA/dashboard-owned, not feature-owned.** The pricing model _causes_ the objection; the perpetual-source + optional-renewal + live updates-window framing _is_ the fix. No engineering required.
- **Integration is where deals actually die.** It's the cluster with real scar tissue and real prior "build" verdicts, so a `/compare`-adjacent "does it fit my stack" adapter matrix + a runnable demo is worth more than any additional module.
- **VENDOR credibility (cluster 8) is the one gate with no owned surface answer pre-launch** — no logos exist yet. Flag it as an open risk; the honest interim is the Apache-2.0 open Base (peer-reviewable), a public changelog, and founder-transparency positioning until real references land. Note the awkward tension: 5 buyers cite _open-source/community_ as their trust substitute (`af2-41de`, `af1-8a5b`, `afa-619a`, `afa-618b`), which the commercial-module model only partly satisfies — the open Base is the lever that exists.

---

# Appendix — Accuracy critic report (verification pass)

Verification complete. All checks done — compiling the report.

---

# ACCURACY CRITIC REPORT — 4 lenses vs 45 raw transcripts

**Method:** dumped all 45 JSON transcripts to text, confirmed `is_simulation` flags, and grep/Python-verified 25+ load-bearing claims (verbatim quotes, counts, human-vs-synthetic attributions). Note: piped-grep counts through the shell were unreliable here (the documented snip filtering hazard — a multi-file grep silently dropped a real "silver bullet" hit until I re-ran it, and a per-file loop returned false 0/40s); all counts below were re-derived with Python reading files directly.

## Provenance / structural facts — VERIFIED

- **40 synthetic (`is_simulation=True`) + 5 real (`is_simulation=False`) = 45.** Confirmed against the raw flag, not the filename prefix.
- **Only `real-019f3b34` received a product pitch** (assistant turn: "TypeScript source bundle that included WORM audit trails and field encryption… as a one-time purchase"). The other 4 reals (`b04/b06/b4b/b6f`) have zero pitch/price/architecture turns — VERIFIED across all three lenses that assert it.
- **No price anchor ($1,049 / $499) appears in any real transcript** — VERIFIED. The "conceptual, no dollar figure" claim for b34 holds.

## VERIFIED claims (quote exists verbatim + attribution correct)

Synthetic: `af3-5cf8` "non-starter, regardless of code quality" · `af2-41cc` "threat model, design documents, and security review notes" · `af1-8a54` "Trust would hinge on transparency" + "design docs, audit logs, and internal reviews" · `afa-618b` "only if it's built like production code" + "complete with tests, migrations, and failure handling" + "$1,049 seems reasonable" + "within the range we typically consider for tools like this" · `af8-e973` "rarely rely on formats like OSCAL" · `af8-e972` "legal team would likely veto" + "redistribution rights" · `af8-e96a` "three engineer-weeks" + "$15,000" + monitoring tool "under $5k" · `af1-8a48` "six months" · `af4-2842` "couldn't guarantee security patch delivery after the first year" + "build internally" · `afb-9e94` "abandonware" + "I'd be skeptical" · `af9-a6fc` "sounds like a silver bullet—but in reality, skepticism" · `af3-5cff` Postgres/MySQL "three-day" detour · `af8-e969` "case studies or testimonials."

Real-human attributions (all confirmed to genuine `real-*` / `is_simulation=False` files): `b34` "pricing would be a nonnegotiable blocker" + "tied into a specific onetime contract" + Trend Micro outsourcing + Oracle · `b06` "not directly responsible for building the product" + "clarify that I wasn't the technical owner" + "fragmented documentation" · `b4b` "never implemented it myself" + "should be a red flag" + "evidence as a byproduct of good practices" · `b6f` "automatically go somewhere and stay" + Azure Key Vault + Netwrix · `b04` "not in my specifics wheelhouse" + "clerical work" / "make my job a lot easier" + Hyperproof/Whistic/Risk Recon.

Count claims: OSCAL — 26 synthetic _user-turn_ mentions (matches "~25"), 0 reals ✓. WORM — 39/40 synthetic user turns; 0 real user turns (the 1 WORM hit in a real file is the _interviewer's_ pitch to b34, so "0 reals use the term" holds) ✓.

## FAILED / ERRONEOUS claims

1. **`objections` lens corpus note is factually wrong.** It states: _"the payload carries 44 extractions (5 real-_, 39 syn-_); the brief names 45 — one appears absent."_ **There are 45 files: 40 synthetic + 5 real. None is absent.** The lens undercounted synthetics by one and invented a missing file. **Consequence:** every ranked-table denominator ("25/44", "22/44", …) is off-by-one _and_ mixes the 4 zero-objection reals into the base — the real denominator for objection prevalence is 40 synthetic (41 if you count b34). Correct the note and re-base the fractions to /40.

## Minor attribution slippage (substance holds, wording cleaned)

- `b34` "flexibility to move and adapt" — actual transcript reads "flexibility **to to** move and adapt according to our needs" (a stutter/transcription artifact); the clean-up is fair.
- `b34` "signed the contract with Trend Micro… **as an external vendor**" (syn-vs-real §3b) — "as an external vendor" is the **interviewer's** phrasing, not the user's; the user said "sign the contract with Trend Micro… who are managing that for us." Outsourcing substance is correct.
- `b34` "**nonnegotiable blocker**" — the interviewer's preceding question supplied the phrase "what would be your biggest non-negotiable blocker for a purchase?" The user filled it with "pricing." Genuine signal that price is top-of-mind, but this flagship real data point was itself a **leading-question fill** — none of the lenses flag that, which slightly undercuts using it as the clean "real inverts synthetic" anchor (it's real, but interviewer-scaffolded).

## UNVERIFIABLE (not independently reproducible from the raw text)

- **Theme 2 architecture split "14 modular / 15 platform / 6 hybrid / 10 unclear"** — requires subjective per-transcript classification; I did not reproduce the exact tallies. Spot-checked exemplars hold directionally (`af2-41de` reads "comprehensive/unified" = platform; `af3-5cff` = platform). The critic's core point (the _maturity/agency causal axis_ has no textual support) is sound regardless of the exact split.
- **Themes "40/40 named proof… ~37 auditor-language artifacts"** — proof-artifact demand is near-universal in the synthetic set (corroborated), but the precise 37 was not reproduced; treat as directional.

## What is MISSING — patterns the four lenses failed to surface

1. **Social proof / case studies / testimonials / "proven in similar context" is a near-headline trust gate (~31/40 synthetics) that no lens elevates.** Buyers repeatedly make _evidence of other customers' success_ a precondition ("detailed case studies or testimonials showing proven success in similar contexts"; "testimonials from similar agencies"; "customer testimonials or case studies that validate its effectiveness in similar environments"). The `objections` lens buries this in cluster 8 at **8/44** and calls it a minor gate — it's ~4× more prevalent than counted, and it is **distinct from the technical proof-artifacts theme** (threat models/OSCAL/test coverage). Strategically it's the single most important omission: it is the **one gate Caisson cannot satisfy pre-launch** (zero reference customers), so under-weighting it hides the study's biggest go-to-market risk.

2. **Ongoing support / SLA / maintenance _responsiveness_ is a distinct recurring axis (~19–39/40) collapsed into the abandonware/renewal frame.** Theme 3 and the pricing lens treat post-12-month worry only as "will the code brick / will patches keep coming." But a large share of synthetics separately gate on _support quality and responsiveness_ ("assurance of ongoing support availability," "inadequate customer support" as a blocker) — an operational-support demand that renewal-as-patch-insurance framing does not fully answer.

3. **Trial / sandbox / PoC access as a conversion lever (~11/40)** shows up only as a minor sub-bullet in the pricing and objections lenses, never as its own finding — yet it is the most concrete _de-risking_ ask buyers volunteer, and it directly answers the integration-fit veto the objections lens itself ranks highest-severity.

**Bottom line:** the verbatim quotes and human-vs-synthetic attributions are overwhelmingly accurate — the four lenses did honest sourcing. The one hard error is the `objections` lens's "44 extractions / one absent" miscount (should be 45 / 40-syn, re-base all its ratios). The one substantive blind spot shared across all four is **social-proof/reference demand (~31/40)**, the gate Caisson can least afford to under-count.

# Crosswalk claim-language research memo — SOC 2 / PCI DSS / GDPR (ADR-0277)

**Date:** 2026-07-07. **Scope:** how to phrase and format the named-regime crosswalks ADR-0277
locks (SOC 2, PCI-DSS, GDPR exports over the OSCAL machinery) without over-claiming. All external
citations retrieved 2026-07-07 via exa web search/fetch unless noted. This is a research memo, not
a decision — it feeds whoever drafts the crosswalk copy and the ADR-0275 evidence-pack disclaimer.

**Binding floor already locked at Caisson (do not re-litigate, extend it):** ADR-0080 §"Copy-law
additions": _"State the technical-vs-administrative boundary plainly and bindingly: Caisson ships
the technical controls; org controls (HR/vendor/IR) and the audit remain yours — never imply
Caisson is itself SOC 2/HIPAA certified; it generates the evidence... a precise-scope guardrail:
'Caisson ships the technical controls CC6.x/CC7.2 require' — never 'Caisson makes you SOC 2
compliant' (over-claim is a trust and YMYL legal risk)."_ — `knowledge/decisions/ADR-0080-copy-messaging-expansion.md:30-35`.
Everything below extends this to PCI-DSS and GDPR and to the crosswalk _artifact_ (not just site copy).

---

## a) The claim-language spectrum, with real vendor phrasing

Five rungs, weakest-claim to strongest, with the entity each claim is actually predicated of:

1. **"Certified / attested"** — a third party issued a formal instrument about the AUDITED ENTITY'S
   OWN operations. Only the audited/certified party may use it, and only about itself.
   - Stripe, about itself as a hosted payment processor: _"Stripe is certified annually by an
     independent PCI Qualified Security Assessor (QSA) as a PCI Level 1 Service Provider meeting
     all PCI requirements."_ Source: docs.stripe.com/security/guide.
   - AICPA is explicit that **SOC 2 has no certification at all** — it is an attestation
     (an auditor's _opinion_, not a pass/fail credential): _"SOC is a suite of assurance reports
     CPAs provide on system-level controls; the AICPA writes the criteria but issues assurance
     reports, not certifications."_ Source: journalofaccountancy.com/issues/2026/feb/promises-of-fast-and-easy-threaten-soc-credibility
     (2026-02-01) — the term the SOC 2 examination itself never uses is "compliance." "SOC 2
     certified" is documented AICPA-logo trademark misuse, not a style nit: amitkoth.com/soc-2-attestation-vs-certification,
     mjd.cpa/resources-posts/how-do-i-communicate-my-new-soc-2-r-report-soc-2-certified.
   - **Implication for Caisson: this rung is categorically unavailable.** Caisson is not the
     audited entity for the buyer's SOC 2/PCI/GDPR posture — the buyer is. Caisson can never be
     "SOC 2 certified" (nothing is), "PCI DSS certified" (see §b), or "GDPR certified" (see §b);
     these words may only ever describe the _buyer's own_ eventual attestation/validation.

2. **"Compliant"** — asserts a completed, current state of conformance for a specific entity's
   processing/environment, not a product feature. Twilio and HashiCorp use it loosely on trust
   pages, but always backed by their OWN certifications for their OWN hosted service (Twilio:
   _"Twilio holds the following security-related certifications and attestations: ISO/IEC 27001...
   SOC 2 Type 2"_ — twilio.com/en-us/legal/security-overview). Caisson ships code the buyer runs
   inside the buyer's own systems; Caisson is not the hosted entity being assessed, so "compliant"
   applied to Caisson (or "the compliance bundle") is a category error, not just an overclaim.

3. **"Satisfies control X"** — a specific, falsifiable claim that a named control's requirement is
   fully met. Vanta/Drata use verbs this strong only inside their OWN product, about the BUYER'S
   own control implementation status inside the buyer's live, continuously-monitored environment —
   never about a third-party vendor's shipped code in the abstract. Drata's own docs hedge even
   there: _"DCF controls are... neither prescriptive nor exhaustive... Organizations are encouraged
   to evaluate the suggested controls through the context of their business."_ Source:
   help.drata.com/en/articles/11632648-introduction-to-the-drata-control-framework-dcf. A shipped
   library, evaluated once at authoring time and not continuously monitoring the buyer's live
   deployment, cannot honestly claim "satisfies" — satisfaction is a property of a configured,
   running system, which Caisson does not operate or observe.

4. **"Maps to"** — a data-mapping relationship between two catalogs (a control ID and a regime
   control ID), with no assertion about implementation completeness or correctness in the buyer's
   context. This is Drata's actual UI/export verb: _"Requirements to controls... Mapped controls
   are listed for each requirement... A single control may appear multiple times if it maps to
   multiple requirements."_ Source: help.drata.com/en/articles/13381891-export-control-to-requirement-mappings.
   Vanta's process language is similarly verb-neutral: _"Map controls. Remediate gaps. Answer
   auditor questions."_ Source: vanta.com/resources/vanta-delivers-calmpliance. NIST OSCAL's native
   verb is the same register: an `implemented-requirement` is explicitly _"only a suggestion of how
   to implement, which may be adopted wholesale, changed, or ignored"_ by the consuming party.
   Source: pages.nist.gov/OSCAL-Reference (component-definition model, v1.2.2).

5. **"Supports / provides evidence toward"** — the correct rung for a shipped software component
   contributing to someone else's compliance obligation. This is the PCI SSC's own mandated
   framing for payment-software vendors, repeated near-verbatim across every PCI SSC document: _"The
   use of Validated Payment Software may help support the security of an entity's cardholder data
   environment, but does not make an entity PCI DSS compliant."_ Source:
   listings.pcisecuritystandards.org/documents/Secure-Software-Program-Guide-v1.pdf. AWS's Config
   conformance packs use the identical register: _"not designed to, and do not, ensure your
   compliance... neither replaces your need for internal efforts... nor guarantees that you will
   pass any compliance assessment."_ Source: aws.amazon.com/about-aws/whats-new/2020/10/aws-config-adds-15-new-sample-conformance-pack-templates-and-introduces-simplified-setup-experience-for-conformance-packs
   (2020-10-01).

**Recommendation: Caisson's crosswalk copy lives at rung 4 ("maps to") in the table body and rung 5
("supports/provides evidence toward") in the surrounding prose and disclaimer** — exactly where
ADR-0080 already put the SOC 2/HIPAA framework pages ("ships the technical controls CC6.x/CC7.2
require"). Never rung 1–3 for anything with "Caisson" as the grammatical subject.

---

## b) Legal exposure

### FTC — deceptive-claims doctrine (Section 5, FTC Act)

The FTC's most directly relevant enforcement pattern is **~40 settled cases (2014–2020) against
companies that claimed current participation in the EU-US Safe Harbor / Privacy Shield frameworks
after their certification had lapsed or was never completed** — 12 companies in 2014, 13 in 2015, 3
in 2017, ReadyTech in 2018 (claimed to be "in the process of certifying" without completing it),
NTT/RagingWire in 2020. Sources: ftc.gov/news-events/news/press-releases/2014/01/...,
/2015/08/..., /2017/09/..., /2018/07/..., ftc.gov/business-guidance/blog/2020/06/ftc-settlement-focuses-those-other-privacy-shield-framework-requirements.
**The doctrine that matters here: claiming current conformance with a named, well-known
framework/program is independently actionable under Section 5 even without a separate showing of
actual harm** — the false framework claim itself is the violation. Every settlement barred
_"misrepresenting the extent to which [the company] participate[s] in any privacy or data security
program sponsored by the government or any... standard-setting organization"_ — language broad
enough to cover a crosswalk overclaiming conformance with SOC 2/PCI/GDPR by name.

**Most directly on point: FTC v. accessiBe (settled Jan 2025, $1M).** accessiBe marketed an
AI-powered web-accessibility plug-in claiming it _"can make any website compliant with WCAG."_
The FTC's complaint: the product did not reliably make websites WCAG-compliant, so the _compliance-enabling_ claim itself was false/unsubstantiated — not a claim about accessiBe's own status, but
about what the tool does _for the customer's_ compliance posture. Source:
ftc.gov/news-events/news/press-releases/2025/01/ftc-order-requires-online-marketer-pay-1-million-deceptive-claims-its-ai-product-could-make-websites
(2025-01-03). **This is the closest analog to a compliance-mapping tool**: a crosswalk that reads
as "install Caisson's compliance bundle and you satisfy SOC 2 CC6.1" is the same claim shape FTC
sanctioned here — a tool asserting it confers a named-standard compliance status on the buyer.

Two supporting cases on overstated technical-security claims (not framework-name claims, but the
same "specific, checkable claim → must be true" doctrine): **Uber (2017)** — settled over claims
that Uber "closely monitored and audited" access to personal data when it hadn't, and over
inadequate encryption of an AWS S3 datastore despite privacy-policy claims of "industry-wide
commercially reasonable security practices." Source: ftc.gov/news-events/news/press-releases/2017/08/uber-settles-ftc-allegations-it-made-deceptive-privacy-data-security-claims.
**Zoom (2020)** — settled over "end-to-end, 256-bit encryption" claims that were false. Source:
ftc.gov/news-events/news/press-releases/2020/11/ftc-requires-zoom-enhance-its-security-practices-part-settlement.
Both establish that a specific technical claim ("we encrypt," "we monitor," and by direct extension
"we satisfy control X") must be literally true, not aspirational or marketing shorthand.

**Current enforcement lens (2024–2025, "Operation AI Comply" / "AI washing"):** the FTC has made
explicit that unsubstantiated capability claims about AI-assisted tools are a standing enforcement
priority, extending to B2B software sold to small businesses (not just consumer products). Sources:
ftc.gov/news-events/news/press-releases/2024/09/ftc-announces-crackdown-deceptive-ai-claims-schemes
(2024-09-25); mondaq.com/unitedstates/fin-tech/1675538/ftc-files-new-ai-washing-case (2025-09-09).
Relevant if the compliance bundle's evidence-generation is ever marketed as "AI-generated" —
substantiate before claiming, and review the marketing copy specifically, not just the crosswalk
table.

**Section 5 also reaches _implied_ claims** — a visual "✓" grid mapping Caisson modules against
regime control IDs, with no accompanying hedge, can itself be the deceptive representation even if
no sentence literally says "Caisson is compliant." This bears directly on §c format guidance below.

### PCI SSC — who may claim PCI compliance, and what a software vendor claims instead

**A software vendor cannot be "PCI DSS compliant."** PCI DSS validation applies to _merchants and
service providers_ who store/process/transmit cardholder data (via QSA-led Report on Compliance,
or a merchant/ISA-signed Self-Assessment Questionnaire + Attestation of Compliance) — not to a
standalone software product. Source: pkfavantedge.com/it-audit/pci-dss-for-software-developers
(practitioner explainer, corroborated by primary PCI SSC program guides below).

The vendor-facing track is the **PCI Software Security Framework** (Secure Software Standard +
Secure SLC Standard), which **replaced PA-DSS in October 2022**. Its own program guide states the
exact boundary language every PCI SSC document repeats: _"The use of Validated Payment Software
may help support the security of an entity's cardholder data environment, but does not make an
entity PCI DSS compliant, or imply compliance with or result in validation to any other PCI SSC
standard."_ Source: listings.pcisecuritystandards.org/documents/Secure-Software-Program-Guide-v1.pdf.
The retired PA-DSS standard used the identical construction: _"Use of a PA-DSS compliant
application by itself does not make an entity PCI DSS compliant."_ Source:
listings.pcisecuritystandards.org/documents/pci_pa_dss_program_guide_v2.pdf.

**Caisson's compliance bundle is not payment software** (it doesn't store/process/transmit
cardholder data itself) and is therefore **not eligible for any PCI SSC validation track at all** —
not Secure Software Standard, not Secure SLC. The only honest claim available is the weakest rung:
the bundle's mechanisms _support_ or _help the buyer address_ specific PCI DSS requirements the
buyer's own environment must still be validated against by a QSA/SAQ. Never write "PCI compliant,"
"PCI DSS compliant," or "PCI certified" with Caisson as the subject, under any hedge.

### GDPR — "compliant" claim norms for processors vs. toolmakers

GDPR Article 42 establishes a voluntary certification mechanism, but it is scoped to **processing
OPERATIONS carried out by a controller or processor** — never to a standalone software product.
The EDPB's own guidance is explicit and directly on point for a library vendor: _"a software
provider cannot apply for certification for a software tool if it is a standalone product used
only at the client's site without the involvement of the provider. This is because GDPR
certification is intended for controllers or processors and not for manufacturers of standalone
products."_ Source: EDPB Guidelines 1/2018 on certification (dpa.gr/sites/default/files/2020-08/edpb_guidelines_1_2018_certification_en.pdf,
§15); consistent restatement in the EDPB's 2021 certification-criteria draft
(edpb.europa.eu/system/files/2021-04/edpb_guidelines_certification_criteria_assessment_formatted_en_0.pdf).
The UK ICO's practitioner-facing framing is blunter: _"Consequently, standalone products cannot be
GDPR certified."_ Source (secondary but accurately summarizing the same EDPB text):
dpo-privacy-support.com/gdpr/gdpr-certification-myth (2025-03-25); primary: ico.org.uk/for-organisations/advice-and-services/certification-schemes/certification-schemes-a-guide.

Caisson, shipped and instantiated inside the buyer's own systems (not a Caisson-operated processor
of the buyer's end-user personal data), sits squarely in the excluded "standalone product" bucket.
**"GDPR compliant," "GDPR certified," and "GDPR-compliant module" must never appear with Caisson as
the subject.** The only accurate framing: Caisson's mechanisms help the buyer (as controller or
processor) implement the Art. 25/32 technical-and-organizational-measures obligations that fall on
_them_ — the crosswalk documents mechanism-to-article mapping, not a certification.

---

## c) Recommended crosswalk document format

### Columns (per regime, per row = one control)

| Column                         | Content                                                                                                                                           | Modeled on                                                                                                                                                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Regime control ID              | e.g. `CC6.1` (SOC 2 2017 TSC), `PCI DSS 4.0.1 Req 3.4`, `GDPR Art. 32(1)(a)`                                                                      | Drata's "Requirements to controls" export shape (help.drata.com/en/articles/13381891)                                                                                                                                                                                                |
| Control text summary           | One-sentence paraphrase of the regime's requirement, dated to a specific revision (see versioning note below)                                     | OSCAL `implemented-requirement/description` + Drata's requirement rows                                                                                                                                                                                                               |
| Caisson module / mechanism     | The specific package + mechanism (e.g. `@caisson/audit-worm` — append-only S3 Object-Lock chain), never a bundle-level generality                 | OSCAL `component` (`title`, `type: software`) + `control-implementation/implemented-requirement` — pages.nist.gov/OSCAL/learn/tutorials/implementation/simple-component-definition                                                                                                   |
| Evidence artifact              | Pointer into the ADR-0275 evidence pack (test-coverage report, OSCAL export, WORM live-proof) — never a bare assertion with no artifact behind it | AWS Artifact's "audit artifact retrieval" model (aws.amazon.com/artifact/faq) — evidence lives in a fetchable document, not just prose                                                                                                                                               |
| Buyer-responsibility remainder | What Caisson does NOT cover for this control — org policy, staffing, the buyer's own configuration, the buyer's own audit engagement              | AWS's Shared Responsibility "of the Cloud / in the Cloud" split (docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html) and the HITRUST/AWS Shared Responsibility Matrix pattern (hitrustalliance.net/shared-responsibility-and-inheritance-program) |

Note: OSCAL's native component-definition model does not have a "buyer-responsibility remainder"
field — it only carries the supplier's own implemented-requirement statement. The remainder column
is an editorial addition on top of the OSCAL export, matching what AWS/HITRUST publish as a
separate Shared-Responsibility-Matrix document alongside (not instead of) the raw control mapping.
Do not let the fifth column get silently dropped when the OSCAL data feeds the crosswalk — it is
the load-bearing column that keeps the whole document at rung 4/5 of §a instead of drifting to rung 3.

### Disclaimer text — verbatim patterns to adapt, and where they must appear

Closest direct analog (a compliance-mapping SaaS's own table disclaimer, not a payments/cloud
vendor's): _"Relevance Indicators, Not Compliance Assertions: Coverage labels ('Directly relevant',
'Related', 'Prerequisite') indicate that a technical control addresses the same security domain as
a regulatory requirement. These labels do NOT assert that implementing a control satisfies,
fulfills, or guarantees compliance with any legal requirement."_ Source: cyber-laws.com/en/disclaimer.
Adapt directly: Caisson's crosswalk labels ("maps to") indicate domain overlap, not requirement
satisfaction.

AWS Config's conformance-pack disclaimer (verbatim, reusable near-as-is): _"[These mappings]... are
not designed to, and do not, ensure your compliance with any such standard or framework and it is
your responsibility to ensure any such compliance. Using [this crosswalk] neither replaces your
need for internal efforts to ensure compliance with any applicable standard nor guarantees that you
will pass any compliance assessment."_ Source: aws.amazon.com/about-aws/whats-new/2020/10/....

PCI SSC's construction, reusable for the PCI crosswalk specifically: _"[These mechanisms] may help
support [requirement], but do not make your organization PCI DSS compliant."_ Source:
listings.pcisecuritystandards.org/documents/Secure-Software-Program-Guide-v1.pdf.

Vanta's MSA liability-scoping clause (a contractual pattern worth mirroring in spirit, not
verbatim, since Caisson sells a library not a SaaS): _"[Vendor] will have no liability or
responsibility for [buyer's] various compliance programs, and... the [product], to the extent
applicable, [is] only [a] tool[] for assisting [buyer] in meeting the various compliance obligations
for which it solely is responsible."_ Source: vanta.com/legal/terms §7.3.

**Where it must appear (pattern across every vendor above): inline, next to the table, on every
page/artifact that carries the mapping — not once in a central ToS.** Cyber Laws puts its
disclaimer directly beside the mapping UI, not just in a site-wide legal page. AWS repeats its
shared-responsibility disclaimer on every relevant doc page. **The binding implication for
Caisson: because ADR-0275 packages the crosswalk inside a portable, downloadable evidence-pack
artifact (tarball, handed to a security reviewer outside the site's context), the disclaimer text
must be embedded in the artifact file itself** (e.g. a header block in the crosswalk JSON/markdown,
not only a note on the pre-purchase web page that links to it) — the reviewer opening the artifact
cold, with no site chrome, must see the same scope language.

### Versioning

Every disclaimer example above ties the mapping to a **specific, dated regime revision** (PCI DSS
4.0.1, SOC 2 2017 TSC with 2022 points-of-focus, a dated GDPR text) — never an evergreen "current"
claim. Caisson's crosswalk rows should carry the same pin (already implied by ADR-0277's "versioned,
golden-file-tested" consequence) and the disclaimer should name the pinned version explicitly, so a
later regime revision doesn't silently stale the claim without anyone noticing.

---

## d) What comparable vendors conspicuously do NOT claim — the negative space

1. **No vendor states a product, by itself, "is compliant."** Compliance is always predicated of an
   audited entity's _processing operations_ or _environment_ — Twilio/HashiCorp claim compliance
   for their own hosted service, having actually been assessed; Vanta/Drata never claim their own
   platform "is SOC 2 compliant" on behalf of a customer, only that the customer's mapped controls
   are "ready" inside the customer's own audit. **Caisson must never write "Caisson is compliant
   with X" or "the compliance bundle is SOC 2 compliant" — the grammatical subject of "compliant"
   must always be the buyer's system, never the module.**

2. **No vendor claims to replace the independent assessor.** Vanta's and Drata's own contracts
   disclaim liability for the customer's compliance program and describe the product as "only...
   tools for assisting" (Vanta MSA §7.3, above). Caisson's `packages/compliance/src/posture/exemption-worksheet.ts`
   already codifies this exact posture internally (`NOT_LEGAL_ADVICE` — _"NOT legal advice and
   asserts no legal conclusion of its own; consult qualified counsel"_) for a different feature (an
   FTC-endorsement worksheet); the crosswalk disclaimer should be a sibling of that same house
   pattern, not a bespoke new one.

3. **No vendor claims exhaustiveness or currency without a version pin.** AWS Config: _"not
   designed to, and do not, ensure your compliance"_; Drata's own control catalog: _"neither
   prescriptive nor exhaustive."_ A crosswalk that silently implies "every control is covered" (by
   omission — no explicit gap list) is itself an overclaim. ADR-0277's own consequence anticipates
   this ("regime claims on the site stay limited to what the exports actually cover") — the
   negative space is: **list what is NOT covered as explicitly as what is**, not just via the
   buyer-responsibility-remainder column but as a visible summary.

4. **No vendor without an actual audited badge borrows one.** The AICPA SOC logo requires
   registration, a clean/unqualified opinion, and expires after 12 months without a fresh report
   (soc2auditors.org/insights/soc-2-logo, probo.com/blog/2026-05-04-are-you-allowed-to-put-soc-2-logo-on-website).
   Caisson holds no such report on itself (ADR-0080 already forecloses claiming one) — so **no
   AICPA/PCI SSC/ISO/GDPR-seal logo or badge may appear on any crosswalk page**, full stop; this is
   categorically different from, and stricter than, the copy-language question.

5. **No vendor conflates its mapping with HITRUST-style "inheritance."** HITRUST's inheritance
   program is a specific, registered, per-control accreditation mechanism (a CSP must hold its own
   current HITRUST certification before a customer can "inherit" a control from it, re-verified on
   every Shared-Responsibility-Matrix version) — a materially heavier apparatus than a static
   crosswalk table (hitrustalliance.net/shared-responsibility-and-inheritance-program). **Never use
   "inherit"/"inheritable" language for Caisson's crosswalk** — it borrows a term of art with its
   own accreditation machinery Caisson does not participate in. Stick to "maps to" / "supports."

6. **No PCI-eligible software vendor claims to be "PCI compliant"** even after actual Secure
   Software Standard validation — the standard's own program guide bars that exact phrase (§b
   above). Caisson, not even eligible for that validation track, has a stricter floor than an
   eligible-and-validated payment-software vendor already accepts.

---

## Recommended language posture (summary)

See final assistant message.

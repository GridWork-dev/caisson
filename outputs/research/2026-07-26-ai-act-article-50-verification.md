---
title: "EU AI Act Article 50 explainer: primary-source verification"
date: 2026-07-26
status: verified research; publication placement remains an operator fork
grounds:
  - outputs/audit/2026-07-board/FORK-WALK-PREP.md
  - knowledge/decisions/ADR-0080-copy-messaging-expansion.md
---

# EU AI Act Article 50 explainer: primary-source verification

## Verdict

The draft is supportable against the three named primary sources. The central timing claim is
verified with one precision correction: the Commission quick-facts page calls the exception a
grace period for the Article 50(2) “marking obligation,” while the final guidelines describe
Article 50(2) as a combined marking-and-detection obligation. The draft therefore uses
**machine-readable marking and detectability duty**.

The transition is narrow. It applies only to the Article 50(2) duty for generative AI systems
placed on the market or put into service before 2 August 2026, and it ends on 2 December 2026.
It does not postpone Article 50 as a whole.

## Retrieval record

All sources were retrieved on **2026-07-26**.

1. **European Commission, “Guidelines on transparency obligations for providers and deployers
   of AI systems.”** The landing page was read through Exa and Crawl4AI. Crawl4AI exposed the
   Commission download URL for the final guidelines. The linked 51-page Commission PDF was
   downloaded and read with page-preserving text extraction.
2. **European Commission, “Quick Facts: Transparency rules for AI systems.”** The complete page
   was read independently through Exa and Crawl4AI.
3. **Regulation (EU) 2024/1689.** The official EUR-Lex ELI page was read through Exa. Crawl4AI's
   full-instrument request timed out and supplied no evidence. Articles 50, 99, 100, and 113
   were then cross-checked in the authentic Official Journal PDF supplied by the EU
   Publications Office, catalogue number FXL2401689EN.

Only the successful retrievals appear as evidence below. No secondary source was used.

## Primary sources

- [Commission guidelines landing page](https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems)
- [Final Commission guidelines PDF](https://ec.europa.eu/newsroom/dae/redirection/document/131215)
- [Commission quick facts](https://digital-strategy.ec.europa.eu/en/factpages/quick-facts-transparency-rules-ai-systems)
- [Regulation (EU) 2024/1689 on EUR-Lex](https://eur-lex.europa.eu/eli/reg/2024/1689/oj?locale=en)

## Claim-by-claim verification

| ID  | Claim as used or considered for the draft                                                                                                                                                                                              | Primary source                                         | Specific locator                                                                                            | Retrieved  | Verdict    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ---------- | ---------- |
| C01 | The Commission published and adopted its final Article 50 transparency guidelines on 20 July 2026.                                                                                                                                     | Commission guidelines landing page                     | Page header, “Publication 20 July 2026”; body paragraph beginning “The Commission adopted these guidelines” | 2026-07-26 | VERIFIED   |
| C02 | The guidelines are non-binding, and only the Court of Justice of the European Union can ultimately give an authoritative interpretation of the AI Act.                                                                                 | Final Commission guidelines                            | Paragraph (5), p. 3                                                                                         | 2026-07-26 | VERIFIED   |
| C03 | Article 50 contains four transparency obligations that apply to different AI systems or outputs.                                                                                                                                       | Final Commission guidelines                            | Section 2.1, paragraph (6), pp. 3–4                                                                         | 2026-07-26 | VERIFIED   |
| C04 | Article 50 applies from 2 August 2026.                                                                                                                                                                                                 | Regulation (EU) 2024/1689; final Commission guidelines | Regulation Article 113, OJ p. 123/144; guidelines paragraph (153), pp. 49–50                                | 2026-07-26 | VERIFIED   |
| C05 | Providers of AI systems intended to interact directly with people must design them so the people concerned are informed that they are interacting with AI.                                                                             | Regulation (EU) 2024/1689                              | Article 50(1), OJ p. 82/144                                                                                 | 2026-07-26 | VERIFIED   |
| C06 | The direct-interaction duty does not apply when the AI nature is obvious to a reasonably well-informed, observant, and circumspect person in context; a separate, qualified law-enforcement exception also applies.                    | Regulation (EU) 2024/1689                              | Article 50(1), OJ p. 82/144                                                                                 | 2026-07-26 | VERIFIED   |
| C07 | Providers of AI systems, including general-purpose AI systems, that generate synthetic audio, image, video, or text must make outputs machine-readably marked and detectable as AI-generated or manipulated.                           | Regulation (EU) 2024/1689                              | Article 50(2), OJ p. 82/144                                                                                 | 2026-07-26 | VERIFIED   |
| C08 | The Article 50(2) technical solutions must be effective, interoperable, robust, and reliable as far as technically feasible.                                                                                                           | Regulation (EU) 2024/1689                              | Article 50(2), second sentence, OJ p. 82/144                                                                | 2026-07-26 | VERIFIED   |
| C09 | Article 50(2) excludes systems to the extent they perform an assistive function for standard editing or do not substantially alter the deployer's input data or its semantics; it also contains a qualified law-enforcement exception. | Regulation (EU) 2024/1689                              | Article 50(2), third sentence, OJ p. 82/144                                                                 | 2026-07-26 | VERIFIED   |
| C10 | Deployers of emotion-recognition or biometric-categorisation systems must inform the people exposed to the operation of the system.                                                                                                    | Regulation (EU) 2024/1689                              | Article 50(3), OJ p. 82/144                                                                                 | 2026-07-26 | VERIFIED   |
| C11 | Article 50(3) contains a qualified law-enforcement exception and separately requires applicable personal-data law to be followed.                                                                                                      | Regulation (EU) 2024/1689                              | Article 50(3), OJ p. 82/144                                                                                 | 2026-07-26 | VERIFIED   |
| C12 | Deployers of AI systems that generate or manipulate image, audio, or video constituting a deepfake must disclose that the content was artificially generated or manipulated.                                                           | Regulation (EU) 2024/1689                              | Article 50(4), first subparagraph, OJ p. 82/144                                                             | 2026-07-26 | VERIFIED   |
| C13 | Evidently artistic, creative, satirical, fictional, or analogous deepfake content receives a limited disclosure regime that must not hamper display or enjoyment; Article 50(4) also contains a qualified law-enforcement exception.   | Regulation (EU) 2024/1689                              | Article 50(4), first subparagraph, OJ p. 82/144                                                             | 2026-07-26 | VERIFIED   |
| C14 | Deployers publishing AI-generated or manipulated text to inform the public on matters of public interest must disclose its artificial generation or manipulation.                                                                      | Regulation (EU) 2024/1689                              | Article 50(4), second subparagraph, OJ p. 82/144                                                            | 2026-07-26 | VERIFIED   |
| C15 | The public-interest-text duty does not apply when the content underwent human review or editorial control and a natural or legal person holds editorial responsibility; a qualified law-enforcement exception also applies.            | Regulation (EU) 2024/1689                              | Article 50(4), second subparagraph, OJ p. 82/144                                                            | 2026-07-26 | VERIFIED   |
| C16 | Information required under Article 50(1)–(4) must be clear and distinguishable, supplied no later than first interaction or exposure, and conform to applicable accessibility requirements.                                            | Regulation (EU) 2024/1689                              | Article 50(5), OJ p. 83/144                                                                                 | 2026-07-26 | VERIFIED   |
| C17 | The December transition is not a blanket postponement: all in-scope systems must comply on 2 August 2026 regardless of their earlier placement on the market or putting into service, subject to one targeted grandfathering rule.     | Final Commission guidelines                            | Section 8.4, paragraph (153), pp. 49–50                                                                     | 2026-07-26 | VERIFIED   |
| C18 | The targeted transition concerns the Article 50(2) marking-and-detection obligation for generative AI systems placed on the market or put into service before 2 August 2026.                                                           | Final Commission guidelines; Commission quick facts    | Guidelines paragraph (153), p. 50; quick facts, “Enforcement and penalties” → “Exceptions”                  | 2026-07-26 | VERIFIED   |
| C19 | The transition ends on 2 December 2026.                                                                                                                                                                                                | Final Commission guidelines                            | Paragraph (153), p. 50                                                                                      | 2026-07-26 | VERIFIED   |
| C20 | A system that is partly interactive and partly generative gets the transition only for Article 50(2); its Article 50(1) interaction disclosure still applies from 2 August 2026.                                                       | Final Commission guidelines                            | Paragraph (153), p. 50                                                                                      | 2026-07-26 | VERIFIED   |
| C21 | Article 50(2) outputs and Article 50(4) deepfakes generated or manipulated before 2 August 2026 do not require retroactive marking or labelling.                                                                                       | Final Commission guidelines                            | Paragraph (154), p. 50                                                                                      | 2026-07-26 | VERIFIED   |
| C22 | Public-interest text generated or manipulated and published before 2 August 2026 does not require retroactive labelling, but text generated earlier and published on or after that date does require a label.                          | Final Commission guidelines                            | Paragraph (154), p. 50                                                                                      | 2026-07-26 | VERIFIED   |
| C23 | Article 50 non-compliance can attract administrative fines up to EUR 15 million or, for an undertaking, up to 3% of total worldwide annual turnover for the preceding financial year, whichever is higher.                             | Regulation (EU) 2024/1689                              | Article 99(4), especially point (g), OJ pp. 115–116/144                                                     | 2026-07-26 | VERIFIED   |
| C24 | For SMEs, including start-ups, the Article 99 fine is capped at the applicable percentage or fixed amount, whichever is lower.                                                                                                         | Regulation (EU) 2024/1689                              | Article 99(6), OJ p. 116/144                                                                                | 2026-07-26 | VERIFIED   |
| C25 | Union institutions, bodies, offices, and agencies can face administrative fines up to EUR 750,000 for non-compliance with requirements other than Article 5.                                                                           | Regulation (EU) 2024/1689                              | Article 100(3), OJ p. 117/144                                                                               | 2026-07-26 | VERIFIED   |
| C26 | “The grace period covers only the Article 50(2) marking obligation.”                                                                                                                                                                   | Final Commission guidelines; Commission quick facts    | Guidelines paragraph (153), p. 50; quick facts, “Enforcement and penalties” → “Exceptions”                  | 2026-07-26 | CORRECTED  |
| C27 | “The August 2 application date was broadly postponed to December 2026.”                                                                                                                                                                | Final Commission guidelines                            | Paragraph (153), pp. 49–50                                                                                  | 2026-07-26 | CORRECTED  |
| C28 | “The broad-deferral reading is widely repeated in secondary coverage.”                                                                                                                                                                 | None among the permitted primary sources               | No primary-source locator; the three sources state the rule but do not measure press or market prevalence   | 2026-07-26 | UNVERIFIED |

## Corrections and exclusions

### C26: “marking” is incomplete shorthand

The quick-facts page uses “marking obligation.” The guidelines use “marking and detection
obligations” and explain Article 50(2) as a duty to mark outputs in machine-readable form and make
them detectable. The draft uses the fuller formulation and does not imply that detectability sits
outside the transition.

### C27: no blanket postponement

Paragraph (153) starts from the opposite rule: all in-scope systems must comply on 2 August 2026,
regardless of when they were placed on the market or put into service. It then identifies one
targeted transition for Article 50(2). The draft states both halves.

### C28: prevalence claim dropped

None of the permitted primary sources measures how often secondary reporting repeats the broad
deferral reading. The draft corrects the reading without calling it widespread, common, or
widely repeated.

## Publication boundary

This pass verifies legal and factual claims only. It does not select a publication surface, add
site metadata, or make a Caisson capability claim.

---
updated: 2026-07-10
status: live
grounds:
  - outputs/research/design-partner-candidates-2026-07-10.md
  - knowledge/decisions/ADR-0297-design-partner-first-n-terms.md
  - docs/gtm/design-partner-program.md
---

# Design-partner outreach — shortlist + channel plan

The curated recruiting layer over the raw candidate research
(`outputs/research/design-partner-candidates-2026-07-10.md` — 30 cited rows across 4 segments,
all evidence dated 2026-07-10). **The outreach itself is an operator GTM act** — this doc
preps it; nothing here sends anything. The terms document to attach is
`design-partner-program.md` (the one-pager).

## Shortlist — the first ten conversations, ranked

Fit-confidence per the research doc; angle = the one-line opener the evidence supports.

| #   | Candidate                      | Segment                     | Angle                                                                                                                                                                                       | Contact                  | Conf.    |
| --- | ------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | -------- |
| 1   | **Legion Health** (YC S21)     | A · healthtech              | Their own job post demands "PHI access, agent actions, human overrides all auditable" on a Node/TS/Next.js stack — that is the Compliance bundle's literal feature list. CTO Daniel Wilson. | YC jobs / LinkedIn       | High     |
| 2   | **Confido Legal**              | A · legal-fintech           | Confirmed TS/Next.js stack (HN Who-is-hiring 2026-03); IOLTA trust-accounting = audit-trail-native domain; 4 named founders incl. CTO Trevor Hanus.                                         | support@confidolegal.com | High     |
| 3   | **Kubera Health**              | A · healthtech              | Hiring "3+ yrs full-stack TypeScript, preferably healthcare/fintech," $6.5M raised 2026-05; founder Roja Garimella MD.                                                                      | careers page / LinkedIn  | High     |
| 4   | **SeedTrust Escrow / Orchid**  | A · fintech+health          | 10-year regulated escrow operator, 3-product ecosystem, job req names TS + "HIPAA/PII-grade standards" — an agency-shaped multi-project buyer with one owner.                               | site contact form        | High     |
| 5   | **Clearest Health** (YC S23)   | A · healthtech              | Job post: Node+TS on Hono/Lambda with explicit "encryption, PHI access controls, audit logging." Founder Nicolas Raga.                                                                      | YC jobs / LinkedIn       | High     |
| 6   | **Readily** (YC S23)           | A/C · compliance-for-health | Itself pursuing HITRUST r2 + FedRAMP — a compliance vendor that must eat its own audit-trail cooking; founders public at founders@readily.co.                                               | founders@readily.co      | High     |
| 7   | **Protocol Wealth LLC**        | C · regulated fintech       | SEC-registered RIA running an open-source TS-strict/Zod "compliance-first OS" (pwos-core, active) — the closest positioning twin found; a partner here is a peer-credibility story.         | GitHub / site contact    | High     |
| 8   | **PURISTA** (Sebastian Wessel) | D · OSS framework           | TS framework pitched "for backends regulated teams can actually approve" (77 stars, active) — integration/cross-link conversation first, purchase second.                                   | mail@sebastianwessel.de  | High     |
| 9   | **Probo** (getprobo)           | C · OSS compliance          | Open-source SOC2/GDPR/ISO27001 platform, React/TS front, 20 contributors + active Discord — community adjacency; join before asking.                                                        | Discord / @getprobo      | Med-High |
| 10  | **EffiGov** (YC S25)           | A · govtech                 | Local-gov AI OS = records-retention + audit surface; stack not TS-confirmed — open with the stack question.                                                                                 | founders@effi-gov.com    | Medium   |

Rows 11–30 (agencies, watch-tier OSS, lower-confidence startups) stay in the research doc —
work the shortlist first; refresh evidence before touching the tail (seed-stage facts decay in
weeks).

## Sequencing

1. **Segment A first, top-5 in one week.** They have the live regulatory pain and the
   cleanest case-study shape ("shipped HIPAA-ready in weeks"). One founder-to-founder email
   each, one-pager attached, no follow-up automation.
2. **C/D conversations run parallel but differently.** Protocol Wealth / PURISTA / Probo are
   peer-credibility plays: open with the technical artifact (the Apache-2.0 base, the WORM
   design), not the discount. For solo OSS maintainers the right offer may be collaboration
   or a comp'd license, not the 40% purchase program — don't force the SKU.
3. **Agencies (Segment B) only after a human gut-check call.** The research flagged an
   SEO-content-mill pattern across several "HIPAA Next.js agency" hits — verify a named human
   and a real client before any partner ask.
4. **Cap at 5 accepted partners** (ADR-0297). Applications arriving via `/partners` count
   against the same cohort — outreach and inbound share the five slots.

## Channel plan (background sourcing, non-spam)

Ten channels documented with evidence + usage rules in the research doc §3. The short version:
YC company/jobs pages and HN Who-is-hiring threads are read-only sourcing (contact via the
company's own published channel); Probo Discord / FINOS Open RegTech SIG / Indie Hackers
require genuine participation before any ask; GitHub OSS candidates get a real issue/PR before
an email; newsletter routes (Fintech Compliance Chronicles, The Compliance Signal, TypeScript
Weekly) are sponsorship/editor conversations, not subscriber pitches.

## What outreach captures (feed the evidence loop)

Every conversation that reaches price is a real-ICP anchor reaction — the exact data gap the
WTP memo (`outputs/research/wtp-memo-2026-07-10.md`) says nothing else closes. Note verbatim
reactions to: the $1,049 anchor, the 12-month renewal terms, single-seat scope at $629/$739,
and which proof artifact (evidence pack, open base, live demo) moved them. Route notes back to
the next pricing sitting; locks stay ADRs.

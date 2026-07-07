# ADR-0273 — Design-partner program: the first-N reference deal

**Status:** accepted · 2026-07-07 (operator-locked, fourth picker round). Grounded in the
Cookiy deep analysis (social proof demanded in ~31/40 interviews — the one gate with no owned
answer pre-launch). Append-only; supersede with a later ADR, never edit. **Tags:** `billing`.

## Context

Reference customers/case studies are the study's biggest under-counted purchase gate and
cannot be satisfied before the first buyers exist. Waiting for organic references leaves the
gate open indefinitely after launch; informal seeding produces no citable proof.

## Decision

A structured design-partner program: a first-N reference deal (~3–5 partners) — discounted or
free bundle in exchange for a citable case study/logo and a feedback loop. **Prepared now,
launched with the production flip:**

- Terms drafted pre-launch (discount level, case-study obligation, feedback cadence) —
  the specific numbers stay operator-owned at flip time.
- A quiet application surface ships with the ADR-0272 site wave (apply-by-email, mirroring
  the `/affiliates` pattern — no public countdown, no roadmap framing).
- Partners double as the integration-fit proof stories the eng-lead gate wants (ADR-0272 §2).

## Consequences

- The transparency block (ADR-0272 §4) is the interim social-proof answer until partner case
  studies exist; the program converts the gap into a pipeline.
- Grant mechanics reuse the existing entitlement/license machinery (a discounted purchase or
  an operator-granted entitlement) — no new product engineering.
- Case-study publication stays operator-gated per the copy laws (claims scraped + dated).

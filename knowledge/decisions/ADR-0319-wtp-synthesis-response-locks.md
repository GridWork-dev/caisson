# ADR-0319 — WTP-synthesis response locks: copy wave R3/R6/R8/R10, proof emphasis, deferred panel re-run, TRADEMARK.md

- **Status:** accepted
- **Date:** 2026-07-10
- **Decider:** operator (picker, four questions)
- **Grounds:** `outputs/research/wtp-synthesis-2026-07-10.md` (12 real-ICP interviews + 2 quant
  surveys, R1–R10 recommendation block); `outputs/research/cookiy-report-2026-07-10.md`

## Context

The full-evidence WTP synthesis validated the ADR-0304 anchors ($1,049 HIGH-confidence hold;
$2,059 hold-but-unverified) and surfaced four copy-level conversion leaks plus a proof gap. The
operator ran a four-question picker over the synthesis's fork-board recommendations.

## Decisions

1. **Copy wave — ALL FOUR fixes locked and shipped in-session** (`apps/site`):
   - **R3 standards naming:** compliance copy now names PCI DSS and GDPR alongside SOC 2/HIPAA
     (hero door claim, compliance-page credential strip + composition lede). Claims are
     true-to-built — the `frameworks-pack` crosswalks (ADR-0277/0279) cover SOC 2, PCI-DSS, and
     GDPR. **ISO 27001 is deliberately NOT claimed** (no crosswalk built); an ISO 27001
     crosswalk goes to the opportunity backlog — interviewees named it unprompted.
   - **R10 support visibility:** support-included language surfaced at the offer level
     (homepage how-to-buy lede, compliance-page credential note) — matching the plans-page
     coverage that already existed.
   - **R8 billing-cadence clarity:** "one-time" cadence marker added to the hero price chip —
     the first price a visitor sees; the plans page already carried the full explanation.
   - **R6 renewal justification:** one sentence on the plans-page renewal card framing 40%
     against 15–20% maintenance norms — it buys the product's releases, not a support
     retainer. No price or lever change; a multi-year discount remains an open fork.
2. **R5 proof assets — code-access + demo emphasis now:** surfaced what exists (marketplace
   live-component rendering) in the built-in-the-open lede. No fabricated testimonials
   (ADR-0237 rider 2 posture); case studies arrive via the design-partner program (ADR-0297).
3. **R7/R2 screened panel re-run — DEFERRED** until an anchor move is actually pending. The
   $2,059 read comes from design-partner conversations in the interim. Standing rule stays: no
   anchor moves on the current panel-compromised quant.
4. **TRADEMARK.md — drafted in-repo now, lawyer redlines as Scope 3** of the engagement
   (`docs/gtm/legal-review-brief.md`). Authored at `scripts/mirror-assets/TRADEMARK.md`, wired
   into the mirror exporter — ships with the public mirror flip (ADR-0318 W0 dependency).
   Elastic four-rule adaptation, fork-renaming per the Valkey precedent, nominative fair-use
   do/don't, `@caisson/*`/`@caisson-sh/*` scope-confusion clause.

## Consequences

- The R4 frame result (platform-clarity + compliance-hook) validates the locked ADR-0040 hero —
  no change, recorded as evidence.
- R9 stands as a guardrail: the "cheaper than expected" cluster is NOT a mandate to raise;
  underpricing is an open question for the screened re-run only.
- New backlog items: ISO 27001 crosswalk (named-standard demand), multi-year renewal discount
  lever (R6 rider), $2,059 direct measurement rung (rides the deferred re-run).

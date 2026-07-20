---
status: locked
locked_by: ADR-0371
tags: [product]
date: 2026-07-20
---

# SPEC — ISO 27001 Statement of Applicability (SoA) generator

**Goal.** An SoA documents, per ISO 27001 Annex A control: applicable?, why, implementation
status. ISO audits formally require one. The crosswalk rollup (ADR-0333/0347) already computes
per-control coverage — this is almost entirely a new render target over existing data.

**SKU posture (ADR-0371):** extends `packages/frameworks-pack` in place — no new SKU.

## Scope

1. A pure function: crosswalk rollup + verification status → SoA rows
   (`control, applicable, justification, status, evidencePointer`).
2. **Render targets: evidence pack (additive section) + OSCAL expression FIRST** (ADR-0371);
   dashboard rendering later.
3. Rendering goes through the **shared render primitive** (one internal package — filter +
   redact + citation rows — shared with the trust-page generator; built in the same lane).
4. The crosswalk SPEC's legal gate carries forward unchanged: no "verified"/"compliant" claim
   language on the ISO surface until the ADR-0319 legal engagement clears; readiness/posture
   language per ADR-0080.

## Non-goals

- No new ISO control-text ingestion (bare identifiers + own-authored paraphrase per ADR-0333's
  licensing floor). No auditor-facing interactivity.

## Verification

- Golden SoA render from a fixture rollup; byte-stable across runs (deterministic ordering).
- A control with no crosswalk row renders `applicable: unresolved` (flag-never-guess), never a
  silent omission.
- OSCAL output validates under the pinned oscal-cli version in the existing conformance gate.

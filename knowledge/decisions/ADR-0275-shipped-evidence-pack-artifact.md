# ADR-0275 — CI-generated evidence-pack artifact: per bundle, pre-purchase and in the box

**Status:** accepted · 2026-07-07 (operator-locked, fourth picker round). Grounded in the
Cookiy deep analysis (22/40 demand auditor-language proof artifacts; the synthetic framing:
"if the team must generate their own threat models, the purchase is a liability"). Append-only;
supersede with a later ADR, never edit. **Tags:** `infra`.

## Context

Every artifact buyers demand already exists somewhere in the repo/CI (OSCAL conformance CI,
threat models, per-package test coverage, WORM live proofs, standards-gate attestations) but
nothing packages them per bundle, and nothing ships them with the delivery. The demand is
"auditor-ready out of the box" — hand the pack to the security reviewer on day one.

## Decision

A **per-bundle evidence pack** built by CI on every release: threat model, OSCAL/control
crosswalk, test-coverage report, SBOM, and the standards-gate attestation, aggregated from
the existing per-package artifacts. Two delivery points:

1. **Pre-purchase download** — feeds the ADR-0272 evidence page (the reviewer evaluates
   before buying).
2. **In the tarball** — the pack ships inside the bundle delivery, versioned with it.

The work is aggregation + packaging (CI plumbing), not new artifact authoring; where a listed
artifact does not yet exist for a package (e.g. a threat model gap), the pack build fails loud
rather than shipping a hole — the coverage gap becomes a visible work item, never a silent
omission.

## Consequences

- The pack becomes a release gate: a bundle release without a complete evidence pack fails CI.
- ADR-0277's named-regime crosswalks land inside this same artifact when they ship.
- The registry/tarball pipeline gains one deterministic build step; byte-identity properties
  of the index are untouched (the pack lives in the tarball, not the index).

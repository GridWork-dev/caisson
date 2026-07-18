# ADR-0363 — Dual-catalog OSCAL spine: build now

- **Date:** 2026-07-18
- **Status:** Accepted (operator-locked)
- **Supersedes in part:** ADR-0333 (the written deferred fork's FedRAMP-ask trigger; the
  fork's preconditions are kept — they become build requirements)
- **Related:** ADR-0277 (demand-driven crosswalk posture) · ADR-0331 (per-row verification;
  its Merkle-commitment sibling fork stays separate and unlocked) · ADR-0347 (crosswalk
  canonicalControlId join + provenance)

## Context

ADR-0333 descoped the compliance crosswalk program to pointer-row rollups and wrote the
dual-catalog OSCAL spine as a deferred fork: the caisson canonical control catalog gains a
generated OSCAL expression, the NIST 800-53 rev5 catalog (confirmed CC0) is vendored
hash-pinned as the authoritative reference axis, and OLIR-style mapping rows join the two.
The revisit trigger was a real FedRAMP ask. At the 2026-07-18 forks-triage picker the
operator chose **build now** over keeping the park or dropping the fork.

## Decision

Build the dual-catalog OSCAL spine now, without waiting for a FedRAMP ask:

1. A **generated OSCAL expression** of the caisson canonical control catalog (the
   `oscal-conformance` CI gate extends to the new artifact).
2. The **NIST 800-53 rev5 catalog vendored hash-pinned** (CC0) as the authoritative
   reference axis — never paraphrased, never mutated in place.
3. **OLIR-style mapping rows** joining caisson controls to 800-53 controls, riding the
   ADR-0347 canonicalControlId join and provenance conventions.

The ADR-0333 preconditions carry over as binding build requirements: a coherent pinned
source bundle (catalog + mapping versions + hashes), a defined update/diff/re-review
lifecycle for upstream catalog revisions, and **no "FedRAMP nearly free" marketing
claims** — copy posture is unchanged by this ADR.

## Consequences

- Spec-first: a SPEC under `outputs/specs/oscal-spine/` precedes any product code; the
  operator gates the PLAN per the standing cadence.
- ADR-0331's Merkle-commitment sibling fork (compact per-row external inclusion proofs)
  remains a separate future fork — not opened by this lock.
- The demand-driven posture of ADR-0277 stays intact for OTHER regimes; this lock opens
  exactly the 800-53/OSCAL axis, nothing else.

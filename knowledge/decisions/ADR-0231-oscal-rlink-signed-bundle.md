# ADR-0231 — OSCAL Assessment-Plan rlink: signed evidence bundle with relative rlinks (Option 1)

**Status:** accepted · 2026-07-03 (fourth picker round, operator-locked). **Reverses ADR-0208 §4**
(the OSCAL back-matter `rlink` won't-fix) and **amends ADR-0179**'s locked `import-ap` resolution
path (absolute `caisson.sh/oscal/assessment-plan/...` URL → relative bundle path + `hashes[]`
SHA-256 integrity binding). Build plan: `outputs/specs/deferred-respec/SPEC-oscal-rlink-hosting.md`
Tasks 2–7 (this ADR is that SPEC's Task 1). Append-only; supersede with a later ADR, never edit.
**Tags:** (none — package-level compliance content; REVIEW-only at SHIP).

## Context

The sold Compliance edition's SAR back-matter emits an `rlink.href` pointing at a
`caisson.sh/oscal/assessment-plan/<framework>` URL that has never resolved — the 3 per-framework
Assessment-Plan documents were never authored (the ADR-0179 §B content debt), and ADR-0208 §4
parked the dead link as won't-fix. Both candidate shapes (signed bundle vs buyer-hosted
convention) require authoring the 3 AP documents; the fork was only the delivery shape.

## Decision

- **Option 1 — signed evidence bundle, relative rlinks, no hosted service.** The export ships the
  OSCAL doc plus a co-located bundle: the 3 real per-framework AP JSON docs
  (`./assessment-plan/{soc2,hipaa,eu-ai-act}.json`), the T13 evidence-pack manifest, and its
  detached Ed25519 signature (reusing `signEvidencePack()` + `canonicalize` unchanged — no new
  crypto). The AP back-matter `rlink.href` becomes a **relative path** into the bundle with
  `hashes[]` SHA-256 bound to the exact bundled bytes (spec-legal per OSCAL v1.2.2; the
  FedRAMP-recommended integrity pattern).
- **Sub-fork: sibling-directory bundle layout** (not a `.tar` — a tar wrapper is a trivial later
  add if a buyer asks).
- **No new hosting surface, no new egress sink** — no `identity/security-surfaces.md` row needed;
  a served sub-variant would require a same-commit row.
- The existing `assessmentPlanHref` buyer-override seam (Option 2's mechanism,
  `oscal-export.ts:218-223`) stays untouched.

## Consequences

- The dead link a sold compliance product ships becomes an honestly-resolvable, signed,
  integrity-bound artifact (`oscal-cli` / viewer-resolvable relative to the doc's own location).
- The AP builder must be deterministic (injected `now`/`newId`) so `hashes[]` and goldens are
  stable; conformance gate extends to the AP docs at v1.2.2 (skip-if-absent per ADR-0180).
- Golden bundle fixtures replace the absolute-URL assertion with the relative href + `hashes[]`.

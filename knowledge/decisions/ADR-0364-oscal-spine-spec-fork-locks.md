# ADR-0364 — OSCAL spine SPEC fork locks (F2-F5)

- **Date:** 2026-07-18
- **Status:** Accepted (operator-locked, same-day picker over the fresh SPEC)
- **Parent:** ADR-0363 (build-now lock) · `outputs/specs/oscal-spine/SPEC.md` (the SPEC whose
  §Forks this ADR resolves) · ADR-0347 (crosswalk provenance conventions)

## Context

The SPEC drafted under ADR-0363 surfaced five forks. F1 (mapping-row home) was already bound
by ADR-0363's own wording — a fifth `regimes.ts`-pattern crosswalk riding the
`canonicalControlId` + `seedProvenance` conventions — leaving four for the operator. Two of
the four locks OVERRIDE the SPEC's recommendation; recorded as deliberate.

## Decisions

- **F2 — relationship vocabulary: adopt NIST IR 8278A's OLIR vocabulary VERBATIM on this
  crosswalk** (operator override of the keep-3-way-enum recommendation): set-theory
  relationship (`subset-of` / `intersects-with` / `equal` / `superset-of` / `not-related-to`),
  rationale (`syntactic` / `semantic` / `functional`), optional 0-10 strength. The existing
  3-way `related|partial|equivalent` enum stays untouched on the four shipped crosswalks —
  the OLIR dialect is scoped to the `nist80053Crosswalk` axis only. The `maps-to` claim cap
  is unaffected (vocabulary describes the mapping, never promotes the claim).
- **F3 — package placement: extend in place** (per recommendation): mapping data + vendored
  catalog in `frameworks-pack`, generator + drift-check in `compliance-core`. No new package,
  no new SKU; whether the axis ever becomes its own priced SKU is a separate pricing fork
  logged to the fork board, operator-owned.
- **F4 — catalog granularity: one merged `caisson-catalog.oscal.json`** (per recommendation)
  spanning every shipped pack's controls; per-framework views derivable later.
- **F5 — NIST catalog refresh: scheduled watch job** (operator override of the manual-v1
  recommendation): a scheduled job periodically checks `usnistgov/oscal-content` for new
  commits on the vendored path and FLAGS a structural diff for operator review — it never
  auto-applies, never rewrites the pin. The Binding-requirement-2 re-vendor procedure remains
  the only write path, operator-triggered. The job's home (intel-daemon watcher vs. CI cron)
  is a PLAN detail; GitHub is an already-sanctioned egress surface either way.

## Consequences

- The SPEC's §Forks section is annotated LOCKED against this ADR; PLAN authoring may begin.
- F2 verbatim-OLIR means the fifth crosswalk carries its own row schema extension (the OLIR
  fields) on top of the `regime-crosswalk.ts` pattern — the PLAN defines the type shape; the
  four existing crosswalks and their goldens are untouched.
- F5 adds a watch lane but no new credential surface and no auto-mutation path.

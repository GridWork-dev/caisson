---
"@caisson/compliance": minor
---

OSCAL Assessment-Plan rlink: author the 3 per-framework AP documents + a signed evidence bundle
(ADR-0231). New `toOscalAssessmentPlan(framework)` emits a minimal-but-valid OSCAL v1.2.2
`assessment-plan` per framework (deterministic via the injected now/newId seam), and a new
`assembleOscalEvidenceBundle()` lays out a sibling-directory bundle (`./assessment-plan/<fw>.json`,
`./sar.json`, `./poam.json`, `./manifest.json`, `./manifest.sig`), rewriting the SAR back-matter
`rlink.href` to the RELATIVE in-bundle AP path with a SHA-256 `hashes[]` binding over the
canonicalized AP bytes and reusing `signEvidencePack()` unchanged. `OscalExportOptions` gains an
`assessmentPlan { rlinkHref; sha256? }` seam; the `assessmentPlanHref` buyer override is untouched;
the OSCAL conformance gate now validates each AP at v1.2.2 (skip-if-absent). Replaces the dead
absolute `caisson.sh/oscal/assessment-plan` URL as the emitted default.

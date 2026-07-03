---
"@caisson/audit-harness": minor
---

audit-harness v2 (ADR-0233): replace the hand-grown domain list with a mechanically derived,
coverage-gated partition. `deriveDomains(root)` emits one domain per tree unit and
`coverage-gate.test.ts` fails loud on any unclaimed or double-claimed unit, so a run can no longer
grow its scope mid-flight. Adds the orthogonal DIMENSION axis (D1..D7 in `dimensions.ts`) with a
sparse class-driven applicability matrix, a dimension-keyed `stableId`
(`domain ∷ dimension ∷ subject ∷ title`), a `reconcile()` that throws on an id collision or an
out-of-universe domain instead of silently dropping a finding, and a per-round coverage ledger
(`coverage.ts`) with an explicit `isRoundDry()` loop-termination predicate. Internal tooling,
non-blocking to a merge.

# ADR-0347 — Compliance-crosswalk PLAN locks: ISO join surface, crosswalk-level seed provenance, one demo implements record, staged format bump

Status: accepted · 2026-07-13 (operator picker rounds over `outputs/plans/compliance-crosswalk/PLAN.md` §5; extends ADR-0333)

## Decision

1. **Fork G1 — ISO rollup participation: the `canonicalControlId` JOIN (overrides the
   parallel-view recommendation).** `RegimeCrosswalkRow` gains an optional `canonicalControlId`
   so collector passes light ISO rows through the same join as the framework packs. The Legal
   gate (ADR-0333) still caps every ISO cell at `maps-to` in v1 — the join buys the surface NOW
   so clearing the expert-review + ADR-0319 legal gates later upgrades claims without a schema
   change. Additive, `.strict()`-safe.
2. **Fork G2 — ISO OLIR seed provenance: crosswalk-level `seedProvenance` on RegimeCrosswalk**
   (one seed object: URL + hash of the 2022-edition OLIR xlsx; machine-checkable, additive).
3. **Fork G3 — v1 authored verification records: ONE reviewed record (overrides the zero-churn
   recommendation)** — on `DATA-PROTECTION.DISPOSAL → SOC2-TSC C1.2` (the one framework-pack
   reference whose regime row is already `implements` — crypto-shred). Re-bless ONLY the
   soc2-tsc catalog golden. The rollup thereby demonstrates one REAL end-to-end `implements`
   cell (the marquee demo of Fork E propagation). Reviewer of record: the operator
   (`reviewedBy`), consistent with Fork B's own-authored + operator-review lock.
4. **Fork G4 — attestation format version: bump `"2" → "3"` when Group D ships.** Each staged
   feature owns exactly one append-only format step (rollup already takes 1→2).

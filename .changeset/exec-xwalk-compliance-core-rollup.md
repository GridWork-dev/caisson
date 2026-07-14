---
"@caisson/compliance-core": minor
---

The cross-framework evidence rollup (ADR-0333/ADR-0347): `computeCrosswalkRollup` joins the shipped
framework packs' existing `crosswalk[]` pointers against per-control evidence status into a
`CrosswalkRollup` (restates, never originates - Fork E claim posture). Evidence-pack format bumps
`v1 -> v2` (ADR-0006 append-only): `crosswalkRollup` is now a required manifest section, assembled
by the generator from a caller-computed value. The OSCAL SAR carries the rollup as a
Caisson-namespaced report-content prop (Fork F), never a new catalog-model artifact. Adds
`buildBindingTable`, a derived control-to-collector projection (PLAN Group E). Re-blesses the
evidence-pack and OSCAL goldens for the v2 bump.

---
"@caisson/compliance-core": minor
---

The cross-framework evidence rollup. `computeCrosswalkRollup` joins the shipped framework packs'
existing `crosswalk[]` pointers against per-control evidence status into a `CrosswalkRollup` that
restates, never originates, a claim. The evidence-pack format bumps from v1 to v2 (append-only, so
old packs are never rewritten): `crosswalkRollup` is now a required manifest section, assembled by
the generator from a caller-computed value. The OSCAL Security Assessment Results export carries the
rollup as a Caisson-namespaced report-content property, never a new catalog-model artifact. Adds
`buildBindingTable`, a derived control-to-collector projection. Re-blesses the evidence-pack and
OSCAL goldens for the v2 bump.

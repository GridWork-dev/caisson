---
"@caisson/frameworks-pack": minor
---

Structured verification provenance for crosswalk mappings. `CrosswalkReference` gains an optional
`verification` object (review status, relationship, source id/version/digest, and reviewer)
replacing the never-shipped `verified: boolean`, alongside an `isVerificationStale` helper.
`RegimeCrosswalkRow` gains an optional `canonicalControlId` join surface (unused until a later
increment wires ISO into the evidence rollup), and `RegimeCrosswalk` gains an optional
crosswalk-level `seedProvenance` pin for the public-domain mapping data a crosswalk was checked
against. Adds the first reviewed verification record: the `DATA-PROTECTION.DISPOSAL` control's
SOC2-TSC `C1.2` reference (crypto-shred), re-blessing only the `soc2-tsc` catalog golden.

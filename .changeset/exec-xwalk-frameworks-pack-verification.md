---
"@caisson/frameworks-pack": minor
---

Structured verification provenance (ADR-0333/ADR-0347): `CrosswalkReference` gains an optional
`verification` object (status/relationship/source/reviewer) replacing the never-shipped
`verified: boolean`, plus `isVerificationStale`. `RegimeCrosswalkRow` gains an optional
`canonicalControlId` join surface (ADR-0347 Fork G1, unused until a later wave wires ISO) and
`RegimeCrosswalk` gains an optional crosswalk-level `seedProvenance` (Fork G2). Authors the one
reviewed verification record in v1: `DATA-PROTECTION.DISPOSAL`'s SOC2-TSC `C1.2` reference
(ADR-0347 Fork G3), re-blessing only the `soc2-tsc` catalog golden.

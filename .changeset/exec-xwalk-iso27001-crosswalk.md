---
"@caisson/frameworks-pack": minor
"@caisson/compliance-core": minor
---

ISO/IEC 27001:2022 as a fourth crosswalk (ADR-0333/ADR-0347 Group C): `iso27001Crosswalk`
(`regimes.ts`) ships seven own-authored rows over bare Annex A identifiers (never Annex A text),
every row `claim: "maps-to"` (the Legal gate) and carrying a `canonicalControlId` pointer into a
real, already-crosswalked framework-pack control. `RegimeId` gains `"iso-27001"`. Each identifier
pairing was checked - never copied - against the pinned NIST OLIR 2022-edition SP 800-53 <->
ISO/IEC 27001:2022 mapping; `iso27001Crosswalk.seedProvenance` pins its URL + independently-verified
SHA-256.

`computeCrosswalkRollup` (`@caisson/compliance-core`) joins `iso27001Crosswalk`'s rows through their
`canonicalControlId` into the same join the framework packs use, so a live collector run lights the
ISO view exactly like SOC2/HIPAA/EU-AI-Act. The Legal gate is enforced structurally: an ISO-driven
contribution never carries a `verification` record, so a cell it contributes to can never render
`implements`. A new schema-level guard on the rollup cell's `note` field extends the `pack-format.ts`
`postureCopy` check (no "compliant"/"certified"/"verified" marketing language) to the rollup
rendering (ADR-0080).

---
"@caisson/frameworks-pack": minor
"@caisson/compliance-core": minor
---

ISO/IEC 27001:2022 ships as a fourth regime crosswalk. `iso27001Crosswalk` provides seven
own-authored mapping entries over bare Annex A identifiers (never Annex A text), each held at the
conservative `maps-to` claim level (the legal gate), and each carrying a `canonicalControlId`
pointer into a real, already-crosswalked framework-pack control. `RegimeId` gains `"iso-27001"`.
Each identifier pairing was checked, never copied, against the pinned NIST OLIR 2022-edition
SP 800-53 to ISO/IEC 27001:2022 mapping; the crosswalk's `seedProvenance` pins that mapping's URL
and an independently verified SHA-256.

`computeCrosswalkRollup` (`@caisson/compliance-core`) joins the ISO crosswalk's entries through
their `canonicalControlId` into the same join the framework packs use, so a live collector run
lights the ISO view exactly like SOC2, HIPAA, and EU-AI-Act. The legal gate is enforced
structurally: an ISO-driven contribution never carries a verification record, so a cell it
contributes to can never render `implements`. A new schema-level guard on the rollup cell's `note`
field extends the existing posture-copy check (no "compliant"/"certified"/"verified" marketing
language) to the rollup rendering.

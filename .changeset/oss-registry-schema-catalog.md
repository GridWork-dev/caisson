---
"@caisson-sh/registry-schema": minor
---

`publishedAt` and `gateAttestation` on a catalog version are now optional, so a catalog built from local packages validates without publish provenance. An unknown module id now reports that it is not in the module catalog.

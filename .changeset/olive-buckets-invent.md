---
"@caisson/registry": patch
---

Publishing a release now redeploys the module registry edge as part of the same run and verifies it against the released catalog, so a newly published version is installable the moment the release completes instead of after a separate manual step.

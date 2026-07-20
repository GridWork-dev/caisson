---
"@caisson/registry": patch
---

Prune 60 superseded historical versions whose downloadable archives were never uploaded to the
registry's storage. These intermediate versions were replaced by newer releases before any
publish run could ship their files, so they advertised entries that could not be downloaded.
Each is now delisted append-only: the publish history is preserved, the versions no longer
appear in the served catalog, and every currently installable version is unaffected.

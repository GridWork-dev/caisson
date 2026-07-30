---
"@caisson/ui": patch
---

Records the design-system package under a fresh version so its published archive matches the bytes
this release actually builds. The package's own source is unchanged, but it names a sibling
workspace package whose concrete version is written into the archive at pack time, and that sibling
moves in this release. Republishing the changed archive under the version already advertised would
leave two different sets of bytes claiming to be the same release, which the release gate refuses.

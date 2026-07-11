---
"@caisson/registry": patch
---

Releases are now commit-addressable: the publish step checks out the exact release tag, verifies the catalog (ledger, index, and recorded per-tarball hashes) against the tagged source tree, and re-packs every tarball requiring byte-equality with the recorded hashes before anything uploads. Version bumps and catalog updates land only through a reviewable version PR — publishing never mutates source, and a re-run never overwrites an already-published version.

---
"@caisson/registry": patch
---

Two additive parity guards for the tarball delivery pipeline: a scheduled probe now verifies every advertised registry tarball byte-for-byte against object storage (fail-closed on missing, unreachable, or drifted objects), and version PRs fail early when a dependency bump would silently change a sibling package's published bytes at an unchanged version.

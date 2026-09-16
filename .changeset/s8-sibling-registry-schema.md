---
"@caisson/registry-schema": patch
---

Patch-bump registry-schema because workspace dependency resolution moved under the bun.lock change. The packed bytes differ from the recorded 0.5.11 tarball despite no package source change, so the release needs a new version and an append-only tarball row.

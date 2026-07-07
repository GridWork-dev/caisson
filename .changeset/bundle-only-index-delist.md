---
"@caisson/registry-schema": patch
---

Re-capture the real-index expansion pins for the bundle-only registry index: the three dissolved
edition meta-packages left the served index, so bundle leaf sets no longer contain them and a bare
edition purchase id now rejects fail-closed (degrading to the free base floor at every consumer)
instead of resolving to its meta-package.

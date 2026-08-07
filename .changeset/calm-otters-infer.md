---
"@caisson/local-inference": minor
---

Add the browser-safe inference port, model constants, and deterministic stub entry, moving the stub's hashing seam from Node crypto to WebCrypto without changing its golden vectors.

Note: this code already shipped in the packages published with v2026.08.06.1 — the version cut was
taken from a base that predated the merge, so this changeset records the bump only.

---
"@caisson/kernel": minor
"@caisson/local-privacy": minor
"@caisson/field-crypto": patch
---

Add narrow browser decision entries that exclude configuration, event delivery, and fetch-capable
code. Browser field encryption now imports the restricted kernel surface, while local-privacy offers
policy admission checks without exposing its network wrapper.

Note: this code already shipped in the packages published with v2026.08.06.1 — the version cut was
taken from a base that predated the merge, so this changeset records the bump only.

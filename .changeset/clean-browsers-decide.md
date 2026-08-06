---
"@caisson/kernel": minor
"@caisson/local-privacy": minor
"@caisson/field-crypto": patch
---

Add narrow browser decision entries that exclude configuration, event delivery, and fetch-capable
code. Browser field encryption now imports the restricted kernel surface, while local-privacy offers
policy admission checks without exposing its network wrapper.

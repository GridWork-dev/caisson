---
"@caisson/kernel": minor
"@caisson/verify-pack": minor
"@caisson/audit-worm": patch
---

Evidence packs now use a v2 detached seal over a canonical manifest containing every exported file
name and SHA-256 digest, and no longer embed executable verifier code. The new commercial
`@caisson/verify-pack` package is the independently obtained verification path and requires an
issuer-key fingerprint obtained independently from the pack before it can report PASS.

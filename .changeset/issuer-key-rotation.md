---
"@caisson/license-verify": patch
---

Rotate the baked production license verification key. Tokens signed by the retired key no
longer verify; fresh tokens issued after 2026-07-05 verify against the new key.

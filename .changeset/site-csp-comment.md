---
"@caisson/site": patch
---

Correct the next.config.ts CSP note: the builder emits the pre-split policy plus frame-src 'self', not a byte-identical policy.

---
"@caisson/ai-kit": patch
---

Test updated for the field-crypto scoped-key migration: the run-tools KMS test now checks key liveness inside the lend rather than reading a returned buffer afterwards. No runtime behaviour change in this package.

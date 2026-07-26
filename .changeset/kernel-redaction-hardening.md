---
"@caisson/kernel": patch
---

Harden deep redaction so compound credential keys and embedded sensitive spans cannot cross proof or evidence-pack boundaries, support append-only composed migration prefixes, and bind authenticated evidence packs to a signed complete-snapshot seal so tail removal or declared-length reduction fails standalone verification.

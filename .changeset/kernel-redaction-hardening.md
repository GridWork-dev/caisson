---
"@caisson/kernel": patch
---

Harden deep redaction so compound credential keys and embedded sensitive spans cannot cross display
surfaces, and make audit proof/evidence-pack exports project payloads through a per-event-type
allowlist that drops unknown fields and fails closed for unknown event types. Also support
append-only composed migration prefixes and bind authenticated evidence packs to a signed complete
snapshot seal.

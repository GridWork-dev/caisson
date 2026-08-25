---
"@caisson/observability": patch
"@caisson/kernel": patch
---

Redact camelCase, snake_case, plural, numbered, fused and fullwidth PII attribute keys. The span
attribute deny-list's word-boundary terms could not see a boundary inside `userEmail` or
`user_email`, so PII-named span attributes reached the OTLP sink unredacted. `isSensitiveAttributeKey`
is the new predicate: it NFKC-normalizes the key and tests the deny-list against both the raw key and
a camelCase/snake_case word split; the raw `SENSITIVE_ATTRIBUTE_KEY` export is deprecated for direct
use. The kernel deep scrubber gains the same camelCase split for its anchored `dob`/`mrn` tokens.
Both splitters are linear in the key length.

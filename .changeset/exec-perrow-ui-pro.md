---
"@caisson/ui-pro": patch
---

The redaction predicate re-homes to the open base: `@caisson/ui-pro`'s `lib/redact` now re-exports
`REDACTED`, `DEFAULT_REDACT_KEYS`, `isRedactedKey`, and `redactValue` from `@caisson/kernel/redact`
(GATE-3). Every `../lib/redact` import stays stable, and the proof-bundle endpoint redacts server-side
from the same predicate. Adds a `@caisson/kernel` dependency.

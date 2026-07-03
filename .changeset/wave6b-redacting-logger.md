---
"@caisson/agent-kernel": minor
---

Add a secret-redacting structured event logger. `makeRedactingLogger` builds a
logger that redacts every string leaf and any credential- or PII-named field in a
structured event before handing it to your own write sink (file, database, log
shipper), and `toRedactedJsonlLine` serializes one redacted event to a single JSON
Lines record. Use it as the default scrub pass before agent audit-trail events are
persisted, so API keys, tokens, and other secrets accidentally captured in an event
payload never reach disk or a downstream log store.

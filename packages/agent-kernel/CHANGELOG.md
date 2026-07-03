# @caisson/agent-kernel

## 0.3.0

### Minor Changes

- cf66d65: Add a secret-redacting structured event logger. `makeRedactingLogger` builds a
  logger that redacts every string leaf and any credential- or PII-named field in a
  structured event before handing it to your own write sink (file, database, log
  shipper), and `toRedactedJsonlLine` serializes one redacted event to a single JSON
  Lines record. Use it as the default scrub pass before agent audit-trail events are
  persisted, so API keys, tokens, and other secrets accidentally captured in an event
  payload never reach disk or a downstream log store.

### Patch Changes

- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1

## 0.2.2

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0

## 0.2.1

### Patch Changes

- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0

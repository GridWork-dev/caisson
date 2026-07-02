---
"@caisson/testing": patch
"@caisson/admin": patch
"@caisson/field-crypto": patch
---

Post-wave-hardening triage Bucket B (CAISSON-10/11/12/13), test and proof hygiene, no
runtime behavior change for buyers.

- CAISSON-12: root bunfig.toml scopes bun test discovery away from stale compiled dist/
  output, plus a regression test in @caisson/testing.
- CAISSON-11: apps/admin's PGlite bootstrap now applies the ADR-0218 line-item migrations
  (0008/0009), matching the deploy-migrate chain, plus a columns-contract-style parity test.
- CAISSON-13: packages/field-crypto's live KMS proof schedules deletion for both throwaway
  CMKs defensively in afterAll, not just the one the last leg reached.
- CAISSON-10: apps/admin's /business degrade path distinguishes a genuine undefined-table
  error (Postgres 42P01) from any other transient DB error before rendering the
  provisioning hint.

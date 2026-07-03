---
"@caisson/billing": minor
---

Dual-layer billing-webhook idempotency. New exports:
`PROCESSED_EVENT_SCHEMA_SQL` (a `billing_processed_event` claim table — tenant-owned FORCE-RLS,
non-blank account guard, shipped as a new checksum-pinned platform migration string, never an edit to
a shipped one); `processEvent(tx, sourceEventId, fn)` (OUTER layer — claim the whole event once via
`INSERT ... ON CONFLICT DO NOTHING RETURNING`, so a re-delivery skips the grant AND leaves no granted
entitlements to trigger the post-commit Discord push, so a re-delivered event cannot re-fire it); and
`withIdempotentSideEffect(tx, sourceEventId, sideEffect, fn)` (PER-SIDE-EFFECT layer). Both run inside
the caller's `withTenant` tx so the claim commits atomically with the grant. The credit ledger stays
the idempotent inner backstop; adds `@caisson/tenancy-rls` as a dependency.

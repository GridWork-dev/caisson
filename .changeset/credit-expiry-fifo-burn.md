---
"@caisson/credits": minor
---

Grant-level credit expiry + materialized FIFO burn. Every grant now stamps
`expires_at` (default issue + 12 months, overridable per grant class via `GrantInput.expiresAt`);
`debit()` walks unexpired grants in FIFO burn order (`created_at, expires_at, id`) and records the
consumption trail in the new append-only `grant_consumption` table, splitting across grants and
never drawing from an expired grant (402 even when the raw wallet aggregate is larger). New:
`CREDIT_EXPIRY_MIGRATION_SQL` + `GRANT_CONSUMPTION_MIGRATION_SQL` (apply after the existing credit
migrations wherever the table is bootstrapped), `expiringSoon()` (the 30-day dashboard badge read),
the idempotent `sweepExpiredGrants()` residue burn (new `expiry_debit` ledger event type), the
notified-once `sweepExpiryNotices()` T-30d email sweep, and `@caisson/jobs` task wrappers
(`defineCreditExpirySweepTask` / `defineCreditExpiryNoticeTask` + enqueue helpers).

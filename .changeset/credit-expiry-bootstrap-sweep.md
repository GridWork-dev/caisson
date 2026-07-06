---
"@caisson/ai-meter": patch
"@caisson/ai-kit": patch
"@caisson/cli": patch
---

Test-double bootstrap sweep for the credit-expiry migrations: every credit-table
bootstrap now applies `CREDIT_EXPIRY_MIGRATION_SQL` + `GRANT_CONSUMPTION_MIGRATION_SQL` (the
`debit()` FIFO path reads `expires_at` and writes `grant_consumption`). No runtime source change
in these packages.

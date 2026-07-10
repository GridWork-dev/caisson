---
"@caisson/platform-migrations": patch
---

Append the order-record subscription-link migration to the shared platform chain: subscription
order rows now carry their backing subscription id and a coverage-stamped bit, so the refund-time
horizon rollback targets exactly the refunded subscription (never re-derived by a shareable price
id) and skips invoices that stamped no coverage.

---
"@caisson/platform-reads": minor
---

Adds `readSubscriptionStatuses` and `readOrderRecords`, typed reads over two new buyer-dashboard
tables: a subscription's current lifecycle state (active/canceled) and an append-only order/invoice
history. Both follow the existing column-contract pattern — a schema rename in the owning service
fails the columns-contract test rather than silently desyncing the reader's SQL.

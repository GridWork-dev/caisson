---
"@caisson/platform-reads": patch
---

Test coverage updated for the new subscription-cancel tombstone semantics: a cancel with
no prior status row now records a canceled tombstone (empty price/plan sentinels) instead
of leaving nothing behind, so out-of-order granting invoices can detect the cancel. Reads
are unchanged; consumers already filter on active status.

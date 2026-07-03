---
"@caisson/site": patch
---

Platform migration 0013 re-creates every platform tenant-isolation policy with an
empty-string guard on the session GUC read: a pooled connection whose tenant setting was
reset to an empty string now always denies instead of coincidentally matching rows. The
platform migration package is also exported for read-only ledger drift audits.

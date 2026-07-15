---
"@caisson/audit-worm": patch
---

Add a read accessor to the audit chain store that returns a tenant's current anchor bytes and length, so scheduled external timestamping can read the latest anchor without reaching into the store's internals.

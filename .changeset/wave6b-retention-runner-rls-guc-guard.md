---
"@caisson/retention-runner": patch
---

Hardened row-level security on the retention-audit table: the tenant-isolation check now
discards an empty-string tenant identifier before comparing it against a row's tenant column,
instead of comparing against it directly. This closes a narrow gap where certain
connection-pooling configurations can leave a database session with an empty string instead
of a properly cleared value, which previously could coincide with a real row's tenant column
and let it be read. Shipped as a follow-up migration alongside the original table migration,
so existing installs pick up the hardening on their next migrate run.

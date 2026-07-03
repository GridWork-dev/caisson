---
"@caisson/tenancy-rls": patch
---

Hardened multi-tenant row-level security in two small ways. The generated
per-table security policy now discards an empty-string tenant identifier
before comparing it against a row's tenant column, instead of comparing
against it directly — this closes a narrow gap where certain connection-pooling
configurations can leave a database session with an empty string instead of a
properly cleared value, which previously could coincide with a real row's
tenant column and let it be read. Also added test coverage that inspects the
database's own catalog to confirm tenant tables truly have row security
enforced (not just that the setup SQL says so), and coverage confirming that a
denied tenant lookup always reports "not found" rather than "forbidden," so a
caller can never tell whether a record exists in someone else's account.

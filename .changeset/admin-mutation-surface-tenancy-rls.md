---
"@caisson/tenancy-rls": minor
---

Add the `withAdminWrite` seam (ADR-0220, Fork AM-2 = B): a dedicated cross-tenant `admin_write`
Postgres role for the operator mutation surface, DB-separated from the buyer `app` runtime.
`buildAdminWritePolicySql(table)` emits a role-scoped `TO admin_write USING/CHECK (true)` policy
(GRANT SELECT/INSERT/UPDATE, no DELETE) alongside the table's existing `app` tenant-isolation
floor, and `withAdminWrite(db, fn)` runs `fn` as that role. Like `withTenant`, it refuses a
SUPERUSER/BYPASSRLS role via the shared guard — now keyed per-`(db, role)` (a WeakMap of role sets)
so the `admin_write` pre-flight is never skipped just because `app` was already vetted on the same
`db`. The buyer isolation contract (the SELECT-only ADR-0141 `admin` read role included) is
unchanged: a `TO admin_write` policy never matches the `app` or `admin` roles.

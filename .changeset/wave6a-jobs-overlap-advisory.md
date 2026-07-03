---
"@caisson/jobs": minor
---

Wave-6a jobs overlap-safety + producer-side advisory lock (ADR-0229 rows 56, 57). `EnqueueOptions`
gains `singletonKey` (row 56): overlap suppression so a slow recurring run never stacks — mapped to
pg-boss's native `singletonKey`, tracked as an in-flight `Set` in the in-memory driver, and a
documented honest no-op in the Trigger.dev driver (its hosted scheduler owns overlap). New export
`withAdvisoryXactLock(tx, key, fn)` (row 57): runs `fn` holding a Postgres transaction-scoped advisory
lock (`pg_advisory_xact_lock`, auto-released at tx end) so a producer-side check-then-enqueue critical
section serializes across workers — the TOCTOU the INSERT-dedup can't cover. Adds `@caisson/tenancy-rls`
as a dependency (the lock runs on a `TenantExecutor`).

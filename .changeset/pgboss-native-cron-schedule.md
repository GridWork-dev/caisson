---
"@caisson/jobs": minor
---

The pg-boss driver now exposes native cron scheduling: `queue.schedule(name, cron, data?, options?)`
ticks a registered task on a cron expression, backed by pg-boss's own durable Postgres-side
scheduler (no new infrastructure, no new dependency). The named task must already be registered
the same way `enqueue`/`work` require, so a typo'd or unregistered name fails before it ever
reaches Postgres. In-memory and Trigger.dev drivers are unaffected — this capability has no
generic-port equivalent since only pg-boss can tick a cron durably inside the database itself.

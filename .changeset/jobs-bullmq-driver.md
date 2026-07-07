---
"@caisson/jobs": minor
---

New `createBullMqJobQueue` driver (BullMQ/Redis), joining Trigger.dev, pg-boss, and the in-memory
reference driver behind the same `JobQueue` port. Redis shops can now self-host the job queue without
Postgres or a managed service. Idempotent retries map to BullMQ's native job id; overlap-safe
enqueues map to BullMQ's Simple-Mode deduplication; cron scheduling maps to a job scheduler; and
`close()` performs a graceful shutdown (workers stop claiming before queue connections release).

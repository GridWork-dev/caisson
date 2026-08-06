---
"@caisson/jobs": patch
---

The BullMQ driver moves to bullmq v6, and ioredis becomes a direct dependency of the jobs package
because bullmq v6 demoted it to an optional peer. No public API or behavior change: the driver
already used job schedulers and deduplication ids, so none of the v6 removals apply to it.

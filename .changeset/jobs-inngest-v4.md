---
"@caisson/jobs": minor
---

Add the injected Inngest v4 job-queue adapter with strict task validation, task-scoped native
idempotency, and a fail-loud rejection when `singletonKey` requests queued-or-active suppression
that Inngest v4 cannot guarantee.

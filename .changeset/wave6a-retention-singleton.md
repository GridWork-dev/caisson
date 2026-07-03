---
"@caisson/retention-runner": patch
---

`enqueueAutoSweep(queue, payload)` — the overlap-safe enqueue site for the `auto_90d` erasure
sweep. Enqueues with a per-(tenant, subject) `singletonKey` so a long-running erasure
can never double-run for the same subject while distinct subjects still sweep in parallel — the real
consumer of the jobs `singletonKey` option.

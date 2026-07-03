---
"@caisson/retention-runner": patch
---

Wave-6a: `enqueueAutoSweep(queue, payload)` — the overlap-safe enqueue site for the `auto_90d` erasure
sweep (ADR-0229 row 56). Enqueues with a per-(tenant, subject) `singletonKey` so a long-running erasure
can never double-run for the same subject while distinct subjects still sweep in parallel — the real
consumer of the jobs `singletonKey` option.

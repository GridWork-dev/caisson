---
"@caisson/jobs": patch
---

ADR-0205 harvest slice-2: grow `@caisson/jobs` a consumer side. `EnqueueOptions.idempotencyKey`
on all 3 drivers (pg-boss: deterministic `sha256`-derived `SendOptions.id` + `ON CONFLICT DO
NOTHING`, not `singletonKey`; Trigger.dev: native `idempotencyKey`; in-memory: a keyed `Set`); a
`work(name)` claim surface on all 3 (pg-boss consumes for real via its native SKIP LOCKED
`boss.work()`, in-memory/Trigger.dev are honest no-ops); `getQueueState(name)` visibility ledger
on pg-boss + in-memory (Trigger.dev's gap is documented, not faked). Conformance test extended
with idempotent-enqueue + `work()` smoke loops.

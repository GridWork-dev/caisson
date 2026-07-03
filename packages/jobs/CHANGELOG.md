# @caisson/jobs

## 0.3.1

### Patch Changes

- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1
  - @caisson/tenancy-rls@0.3.2

## 0.3.0

### Minor Changes

- fb8d966: Jobs overlap-safety + producer-side advisory lock. `EnqueueOptions`
  gains `singletonKey`: overlap suppression so a slow recurring run never stacks — mapped to
  pg-boss's native `singletonKey`, tracked as an in-flight `Set` in the in-memory driver, and a
  documented honest no-op in the Trigger.dev driver (its hosted scheduler owns overlap). New export
  `withAdvisoryXactLock(tx, key, fn)`: runs `fn` holding a Postgres transaction-scoped advisory
  lock (`pg_advisory_xact_lock`, auto-released at tx end) so a producer-side check-then-enqueue critical
  section serializes across workers — the TOCTOU the INSERT-dedup can't cover. Adds `@caisson/tenancy-rls`
  as a dependency (the lock runs on a `TenantExecutor`).

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0
  - @caisson/tenancy-rls@0.3.1

## 0.2.1

### Patch Changes

- 192c81c: ADR-0211 harvest slice-2: grow `@caisson/jobs` a consumer side. `EnqueueOptions.idempotencyKey`
  on all 3 drivers (pg-boss: deterministic `sha256`-derived `SendOptions.id` + `ON CONFLICT DO
NOTHING`, not `singletonKey`; Trigger.dev: native `idempotencyKey`; in-memory: a keyed `Set`); a
  `work(name)` claim surface on all 3 (pg-boss consumes for real via its native SKIP LOCKED
  `boss.work()`, in-memory/Trigger.dev are honest no-ops); `getQueueState(name)` visibility ledger
  on pg-boss + in-memory (Trigger.dev's gap is documented, not faked). Conformance test extended
  with idempotent-enqueue + `work()` smoke loops.
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- 33bee35: Whole-repo audit round-4 remediation (ledger 2026-07-01): BYOK (tenant-key) inference now
  makes zero wallet movement while internal metering still runs, implementing ADR-0182/0198;
  provider-unreported token usage is kept distinct from genuine zero so reconcile settles at
  the reserved estimate instead of silently refunding a real call; the spend-window bucket is
  fixed at reserve and reused at reconcile so boundary-straddling calls no longer undercount
  the hard-cap breaker. Alerting webhook/Slack/Telegram destinations get an https-only +
  private/metadata-range SSRF guard at both the Zod boundary and the fetch seam, mirroring the
  ai-kit baseUrl policy. The retention_audit table gets fail-closed RLS via an append-only
  follow-up migration. The pg-boss production job driver now validates task name + payload
  schema on enqueue like its sibling drivers.
- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0

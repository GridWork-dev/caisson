# @caisson/jobs

## 0.6.2

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/tenancy-rls@0.5.4

## 0.6.1

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/tenancy-rls@0.5.3

## 0.6.0

### Minor Changes

- c3b0e41: The pg-boss job queue driver gains a `stop()` method: it releases the client's maintenance
  timers and its own connection pool if one was ever lazily started, and is a safe no-op
  otherwise. Short-lived callers (a CLI command, a script) that enqueue at least one job
  should call it during their own shutdown so the process can exit promptly instead of being
  kept alive by pg-boss's background timers.

## 0.5.1

### Patch Changes

- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0
  - @caisson/tenancy-rls@0.5.2

## 0.5.0

### Minor Changes

- 2b65cf3: `@caisson/alerting` adds a fifth network channel, `createDiscordChannel` (SSRF-guarded, maps an
  `AlertEvent` to a Discord webhook embed colored by severity), plus a `deliverImmediate` helper for
  callers with no persisted incident/rate-cap state of their own. `@caisson/jobs`' pg-boss driver
  adds an optional `alerting` port (`JobAlertingDeps`) to `createPgBossJobQueue`: a `work()` task
  failure now reports through it before re-throwing (pg-boss's own retry/dead-letter machinery is
  untouched), and the underlying `PgBoss` instance's `error` event — previously unhandled, a process-
  crash risk per pg-boss's own docs — is now wired via the new `wireBossErrorHandler`. Both additions
  are additive and optional; every existing caller keeps compiling unchanged.
- a0aa9a3: New `createBullMqJobQueue` driver (BullMQ/Redis), joining Trigger.dev, pg-boss, and the in-memory
  reference driver behind the same `JobQueue` port. Redis shops can now self-host the job queue without
  Postgres or a managed service. Idempotent retries map to BullMQ's native job id; overlap-safe
  enqueues map to BullMQ's Simple-Mode deduplication; cron scheduling maps to a job scheduler; and
  `close()` performs a graceful shutdown (workers stop claiming before queue connections release).

### Patch Changes

- 8253e76: OSS launch readiness wave. LICENSE copyright restamped to Caisson Software LLC across the
  open set. README/AGENTS prose trued to the built reality: six-bundle vocabulary, current
  entitlement examples, decision-record citations stripped from public-facing docs. The
  eu-ai-act-sample template's kernel pin corrected to the current release line, with a
  dynamic staleness test so future version cuts fail loud. Docs service search now races the
  per-query embed against an eight-second deadline and degrades to the keyword floor instead
  of holding the query open past caller budgets; a refund-policy docs page makes refund
  questions answerable. Site sign-in sets a non-HttpOnly session-hint cookie so owned-items
  UI renders without an extra round trip, and the build ignores a spurious Next trace
  warning. Public-mirror exporter hardened: prose renames scoped to the open package set,
  four mirror-only test exclusions, a root bunfig for the mirror workspace, and a historical
  backfill mode for the rot-guard.
- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
  - @caisson/kernel@0.4.3
  - @caisson/tenancy-rls@0.5.1

## 0.4.1

### Patch Changes

- Updated dependencies [8c53ca3]
- Updated dependencies
  - @caisson/tenancy-rls@0.5.0

## 0.4.0

### Minor Changes

- 4d7eb71: The pg-boss driver now exposes native cron scheduling: `queue.schedule(name, cron, data?, options?)`
  ticks a registered task on a cron expression, backed by pg-boss's own durable Postgres-side
  scheduler (no new infrastructure, no new dependency). The named task must already be registered
  the same way `enqueue`/`work` require, so a typo'd or unregistered name fails before it ever
  reaches Postgres. In-memory and Trigger.dev drivers are unaffected — this capability has no
  generic-port equivalent since only pg-boss can tick a cron durably inside the database itself.

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [0c883ae]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2
  - @caisson/tenancy-rls@0.4.0

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

- 192c81c: Add a consumer side to `@caisson/jobs`. `EnqueueOptions.idempotencyKey`
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

- 33bee35: BYOK (tenant-key) inference now
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

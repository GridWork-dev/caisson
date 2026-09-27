# @caisson/jobs

## 0.7.5

### Patch Changes

- 73bdf3c: Each package's `manifest.ts` now imports `defineModule` from the sibling `registry-schema` package instead of a monorepo-only directory, so the file resolves wherever `@caisson-sh/registry-schema` is installed next to it.
- 784a846: Each package's metadata now links to its source directory in the public repository.
- 73bdf3c: Every package is now Apache-2.0 and publishes to the public npm registry. Each package ships the Apache LICENSE file, and the registry manifest carries the same license. Nothing needs a license key or a private registry to install.
- 0b02891: Every package now publishes under the `@caisson-sh` npm scope. Update imports and dependencies to the new names; module ids in registry manifests use the same scope.
- Updated dependencies [73bdf3c]
- Updated dependencies [73bdf3c]
- Updated dependencies [784a846]
- Updated dependencies [611f1de]
- Updated dependencies [73bdf3c]
- Updated dependencies [0b02891]
  - @caisson-sh/tenancy-rls@0.6.2
  - @caisson-sh/kernel@0.10.1

## 0.7.4

### Patch Changes

- Updated dependencies [498b279]
- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/tenancy-rls@0.6.1
  - @caisson/kernel@0.10.0

## 0.7.3

### Patch Changes

- 2405d9e: Remove unused dependencies and unreferenced internal helpers, relocate integration coverage to the package seams it verifies, and consolidate repeated build and test plumbing. The CLI no longer exports the obsolete minimal `defaultEngine`; use `templatesEngine` or inject a `GeneratorEngine`.
- 2609293: Consolidation wave one: the eighteen refutation-verified cuts from the August consolidation audit.

  New public API: `@caisson/kernel` gains the narrow `./crypto` subpath (node:crypto-only graph,
  so a Cloudflare Worker can import the timing-safe compare without the wide `./node` barrel's
  `node:dns` reach), and `@caisson/tenancy-rls` exports `createPgTransactor(pool)` — the canonical
  node-postgres BEGIN/COMMIT/best-effort-ROLLBACK/release adapter previously copy-pasted across the
  site, admin, the license deploy entry, the CLI, and the generated Next starter (which also gains
  the best-effort rollback it lacked). Everything else is deletion or internal consolidation with
  behavior pinned by tests: dead marketplace/build residue and dead nav derivation out of the site,
  the unused account-entitlement resolver and 111 unreachable barrel exports out of the license
  service, the orphan EU AI Act manifest out of compliance (it was being packed while unreachable),
  an unused trust-page devDependency, shared task-registry lookup across the five jobs drivers,
  shared exact byte-identical parser readers in billing-orchestration, the kernel browser-graph
  walker folded onto the shared testing module-graph, the intel OpenRouter transport shared between
  enrichment and its eval judge, license scheduler test fixtures consolidated, the dependency graph
  guard moved into standards-gate ownership (its test now runs in the package suite), the Better
  Stack adapter's unauthenticated dev bypass deleted and its secret compare folded onto the kernel
  primitive, and one boundary-policy data source feeding ESLint, dependency-cruiser, and the
  standards gate — closing a drifted cruiser hand-copy that had silently stopped guarding the five
  current bundle roots.

- 8993cf7: Bump the supplied ioredis runtime dependency to v6. BullMQ declares ioredis as an optional peer with range >=5.0.0, so the driver contract is unchanged; the connection is still built by the caller and passed through. Reviewed against the v6 release notes (RESP3 by default with RESP2-compatible reply shapes) with the full jobs suite green.
- 1964e9d: Clear two dependency advisories.

  `nanoid` moves to 3.3.18 via the root override (custom generators loop indefinitely when
  size is zero). It is a single hoisted resolution, so the one override covers every consumer
  — including the exact `3.3.8` that `@trigger.dev/core` pins.

  `@trigger.dev/core` moves to 4.5.10 (prototype pollution through run-metadata operations,
  escalating to a process-wide cross-tenant denial of service). Core is not declared anywhere
  in this repo; it is pinned exactly by `@trigger.dev/sdk`, so the fix is a floor on the SDK
  range rather than an override — an override would desync the pair. The range now starts at
  the first fixed release so a future lockfile regeneration cannot resolve back under it.

  The resolver stopped at 4.5.10 rather than the newest 4.5.11 because the seven-day
  release-age floor held it back, which is the floor doing its job.

- 87275f6: Replace ESLint and Prettier with oxlint and oxfmt.

  Linting and formatting now run on the oxc toolchain. The rule floor is unchanged: the same
  no-any, no-console, type-only-import and provider-SDK-boundary rules are enforced, at the same
  severities, and formatting keeps the settings the previous formatter used. Every package here is
  touched by the dependency removal or by the one-pass reformat, so each takes a patch bump; no
  runtime behaviour changes.

  For anyone consuming the shared configuration: the lint config package is renamed, and the lint
  and format commands changed.

- Updated dependencies [f669d4a]
- Updated dependencies [b0e66b6]
- Updated dependencies [2609293]
- Updated dependencies [87275f6]
  - @caisson/kernel@0.9.0
  - @caisson/tenancy-rls@0.6.0

## 0.7.2

### Patch Changes

- 742c979: The BullMQ driver moves to bullmq v6, and ioredis becomes a direct dependency of the jobs package
  because bullmq v6 demoted it to an optional peer. No public API or behavior change: the driver
  already used job schedulers and deduplication ids, so none of the v6 removals apply to it.
- Updated dependencies [7d74f8f]
  - @caisson/kernel@0.8.0
  - @caisson/tenancy-rls@0.5.8

## 0.7.1

### Patch Changes

- e917c52: The Inngest driver now declares the minimum Inngest release it was built and tested against instead of accepting any release in that major line. Installs that resolve an older Inngest no longer satisfy the dependency and get a clear resolution error rather than a runtime failure.
- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0
  - @caisson/tenancy-rls@0.5.7

## 0.7.0

### Minor Changes

- 31bf5f1: Add the injected Inngest v4 job-queue adapter with strict task validation, task-scoped native
  idempotency, and a fail-loud rejection when `singletonKey` requests queued-or-active suppression
  that Inngest v4 cannot guarantee.

### Patch Changes

- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
  - @caisson/kernel@0.6.0
  - @caisson/tenancy-rls@0.5.6

## 0.6.3

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/kernel@0.5.3
  - @caisson/tenancy-rls@0.5.5

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

# SPEC — `@caisson/jobs` consumer-side (claim + visibility + idempotent enqueue)

**Status: LOCKED — ADR-0205, harvest slice-2 wave, 2026-07-02 operator picker.**

- **Package:** `packages/jobs` (Apache-2.0 base, `tier: oss`, `kind: base`). No dependency-tier
  change — `pg-boss` + `@trigger.dev/sdk` already deps; no new packages.
- **Prior art:** ADR-0018 (port), ADR-0173 (pg-boss driver; names this lift "D6").

## Goal (WHAT + WHY)

`@caisson/jobs` is producer-only today: `enqueue(name, payload)` fires into pg-boss /
Trigger.dev / in-memory, but nothing lets a buyer's worker **claim** a job, a retried
producer call **dedupe**, or anyone **read** what's in flight. This slice closes the port —
no new lease table, no hand-written SQL, no new infra.

## Scope

**In:** `EnqueueOptions.idempotencyKey` on all 3 drivers + per-driver tests; a `work(name)`
claim surface on all 3 + a shared conformance smoke test; `getQueueState(name)` on pg-boss +
in-memory, Trigger.dev's gap documented (dashboard is the driver's answer).

**Out:** per-job state reads (needs `enqueue` to return an id — a port-shape change beyond
this slice), a real lease table (unnecessary — see Design), `delaySeconds` (ADR-0173
foreshadows it, not this slice), multi-node work-pool orchestration, Trigger.dev programmatic
run-status (new SDK surface).

## Design

**1. Idempotent enqueue** — `EnqueueOptions { idempotencyKey?: string }`, 3rd param on
`enqueue(name, payload, options?)`. In-memory: `Set<` `${name}\0${key}` `>` on the closure —
repeat key is a no-op. pg-boss: **not** `singletonKey` — its uniqueness indexes are gated
`AND policy = '<policy>'` (`plans.js:611-635`); our default `standard`-policy queue enforces
none, and forcing `policy: 'exclusive'` would also block concurrent _unkeyed_ jobs on the
same name. Instead derive a **deterministic `id`** — `sha256(name + idempotencyKey)`
reshaped into a UUID string (`node:crypto`, no new dep) — as `SendOptions.id`; `insertJobs`
is `INSERT ... ON CONFLICT DO NOTHING RETURNING id` (`plans.js:1414-1502`, unconditional on
the PK), so a repeat id is atomically a no-op regardless of policy — `send()` returns `null`,
driver swallows it. `PgBossClient.send` gains `options?: { id?: string }`. Trigger.dev: pass
`idempotencyKey` straight through as `trigger()`'s 3rd arg (native SDK support). Conformance
file gets a weak smoke assertion only; the strong "exactly one job" check is per-driver, per
the file's own "no driver-specific assertions here" rule.

**2. Claim/work surface** — `WorkHandle { stop(): Promise<void> }`,
`JobConsumer { work(name): Promise<WorkHandle> }`, resolved against the SAME `TaskDefinition`
registry `enqueue` uses (no second handler, no drift). pg-boss: real consumption —
`work(name)` ensures the queue, then `client.work(name, batch => ...parseStrict...handler)`
— pg-boss's own SKIP LOCKED claim (`boss.work`), never hand-written SQL; `stop()` →
`client.offWork(name)`. In-memory/Trigger.dev: **honest no-ops** — in-memory's handler already
runs inline at `enqueue()` (that IS the driver's design, `// ponytail: no backlog to poll —
work() exists for port symmetry`); Trigger.dev's `defineTriggerTask` already registers the
real worker at construction, its hosted platform is the actual consumer, no local
"start consuming" call exists in the SDK. Both 404 on an unknown name, else return a no-op
`WorkHandle`. Conformance test: loop all 3, assert `work` exists and its `stop` is callable.

**3. Visibility ledger** — `QueueState { queuedCount; activeCount; failedCount }`,
`JobLedger { getQueueState(name): Promise<QueueState> }`. pg-boss: `client.getQueue(name)` →
mapped counts; `null` (queue never created) maps to all-zero, not an error. In-memory: since
`enqueue()` is synchronous, a job is `completed` or rejected before `enqueue()` returns — no
observable queued/active state ever exists; track a `Map<name, failureCount>` and return
`{ queuedCount: 0, activeCount: 0, failedCount }` (`// ponytail: honest zero, not a fake
pending-count`). Trigger.dev: **not implemented** — its return type carries no `JobLedger`;
module doc points to the hosted Runs dashboard / `runs.retrieve()` instead. A real
lease/heartbeat table is judged **unnecessary**: pg-boss already persists active/failed/queued

- per-job state durably in Postgres — a parallel table is a second source of truth.

## Tasks

1. `queue.ts` — add `EnqueueOptions`/`WorkHandle`/`JobConsumer`/`QueueState`/`JobLedger`;
   extend `createInMemoryQueue` → `JobQueue & JobConsumer & JobLedger`. Verify:
   `bun test packages/jobs/src/queue.test.ts`.
2. `pgboss.ts` — extend `PgBossClient` (`send` options, `work`, `offWork`, `getQueue`); add
   the sha256-derived id helper; wire `work`/`getQueueState`. Verify:
   `bun test packages/jobs/src/pgboss.test.ts`.
3. `trigger-driver.ts` — extend `TriggerClient.trigger`'s options arg; add no-op `work()`;
   document the ledger gap. Verify: `bun test packages/jobs/src/trigger-driver.test.ts`.
4. `jobs.conformance.test.ts` — add the shared idempotent-enqueue + `work()` smoke loops;
   extend `fakePgBossClient`/`fakeTriggerClient`. Verify:
   `bun test packages/jobs/src/jobs.conformance.test.ts`.
5. Changeset naming `@caisson/jobs` (patch). Verify:
   `bunx changeset status --since=origin/main`.

## Verify (goal-backward)

- A retried `enqueue()` with the same `idempotencyKey` produces exactly one job on in-memory
  (handler called once) and pg-boss (single distinct id, conflict swallowed).
- `queue.work(name)` claims + runs a job through pg-boss's native SKIP LOCKED path with no
  hand-written SQL; in-memory/Trigger.dev expose the same shape, documented as no-ops.
- `getQueueState(name)` returns real counts on pg-boss, honest zero-plus-failures on
  in-memory; Trigger.dev's absence is documented, not faked.
- `bun run check` green inside `packages/jobs`; no new dep, no license-tier violation.

## Effort/Value

Effort: **S–M** (~0.5–1 day). Value: **MEDIUM** — every edition that enqueues jobs (billing
receipts, retention-runner, alerting) gets a real self-host worker path + dedup for free.

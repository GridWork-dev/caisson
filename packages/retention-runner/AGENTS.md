# AGENTS — @caisson-sh/retention-runner

Agent-facing authoring/usage contract (ADR-0020 `agents`). What a generation agent or a downstream
edition must know to wire the erasure runner correctly.

## Invariants (do not violate)

- **Every target runs, even when one fails.** `runErasure` isolates each `ErasureTarget.erase` call —
  a throw is caught into `{ target, ok: false, error }`, never propagated. Never wrap `runErasure`
  itself in a try/catch that skips remaining targets on the first failure; that defeats the isolation.
- **Exactly one audit row per run.** `runErasure` calls `sink.record` once, after every target has
  settled, with the full `results` array. Never call `sink.record` per-target.
- **NOT WORM.** The audit row is plain-Postgres audit-_logging_ (ADR-0135 Genericness). Never import
  `@caisson-sh/audit-worm`/`audit-chain` here or treat `retention_audit` as tamper-evident.
- **`auto_90d` is the only reason enqueued.** `ccpa_request` and `operator_manual` call `runErasure`
  directly — they are one-shot, operator/subject-triggered. Do not route them through the `JobQueue`.
- **Inject `now`.** `runErasure`/`defineRetentionTask` take an injectable clock (`now: () => number`,
  default `Date.now`) — never assume wall-clock time in a caller that needs deterministic replay/tests.
- **The real S3/pg client is a seam, never a dependency.** `createObjectStorageTarget` /
  `createCascadeDbTarget` / `createOrphanSweepTarget` each take an injected minimal client interface.
  Do not add `aws-sdk`/`pg` to this package to "properly" implement a driver — that is prod wiring,
  done by the caller composing the real client and injecting it.

## Entry points

`.` is the full surface. `./browser` (ADR-0396) is the same package minus `schedule.ts`'s
`@caisson-sh/jobs` edge — import it from client code. When you add a name, put it on `.`; add it to
`./browser` too only if its whole value-import graph is free of node builtins
(`src/browser-safety.test.ts` walks that statically and fails the build if not). Never add a name
to `./browser` that is not also on `.` — the subset is one-way.

## Choosing targets

- **Dev/test** — `createCaptureTarget()` (records erasures in memory) + `createCaptureAuditSink()`.
- **Prod** — compose `createObjectStorageTarget`/`createCascadeDbTarget`/`createOrphanSweepTarget`
  with real injected clients, plus a pg-backed `RetentionAuditSink` implementing `src/migrations/
0001_retention_audit.sql`.

## Scheduling (ADR-0152)

`defineRetentionTask(deps)` returns a `@caisson-sh/jobs` `TaskDefinition` for `AUTO_90D_SWEEP_TASK`.
Register it on a `JobQueue` (`createInMemoryQueue` in dev/test; Trigger.dev in prod — the queue
port never changes across drivers). Enqueue through `enqueueAutoSweep(queue, { subjectId, tenantId })`
— never call `queue.enqueue(AUTO_90D_SWEEP_TASK, …)` directly, since `enqueueAutoSweep` sets the
overlap-safe `singletonKey` (`${tenantId}:${subjectId}`) that keeps a subject already queued for a
sweep from being double-enqueued. The subject-selection query itself (who is due for `auto_90d`
erasure) is the caller's concern — this package only runs the erasure once told who.

## Out of scope

No subject-due-for-erasure selection logic, no live S3/pg driver, no WORM/hash-chain upgrade to the
audit row (see ADR-0135 Genericness — audit-logging discipline is not tamper-evidence; don't
conflate the two).

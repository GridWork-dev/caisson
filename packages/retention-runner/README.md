# @caisson/retention-runner

CCPA/GDPR right-to-erasure runner — pluggable multi-store erasure with per-target error isolation
and a reason-tagged audit row. ADR-0135 (module lock) · ADR-0152 (scheduling).

## What it gives you

- **Pluggable multi-store erasure.** The `ErasureTarget` port — object-storage purge, cascade DB
  delete, orphan-record sweep — each target erases one store; `runErasure` fans out to every
  registered target for a subject.
- **Per-target error isolation.** One failing store never aborts the run: each target's outcome is
  caught into a `TargetResult` (`{ target, ok, error? }`), so the other targets still run and the
  audit row reflects exactly which stores succeeded and which didn't.
- **One reason-tagged audit row per run.** `RetentionRunResult` carries the trigger
  (`auto_90d` | `ccpa_request` | `operator_manual`), every target's outcome, and the run timestamp,
  written once via the injected `RetentionAuditSink`. **Plain Postgres audit-logging — not WORM**
  (ADR-0135 Genericness; see `src/migrations/0001_retention_audit.sql`).
- **The recurring `auto_90d` sweep rides `@caisson/jobs`.** `defineRetentionTask` returns a
  `TaskDefinition` — register it on a `JobQueue` (the shipped in-memory driver in dev/test,
  Trigger.dev in prod) and enqueue `AUTO_90D_SWEEP_TASK` per subject due for erasure.
  `ccpa_request`/`operator_manual` are one-shot, operator/subject-triggered calls straight into
  `runErasure` — no queue.

## Use

```ts
import {
  createObjectStorageTarget,
  createCascadeDbTarget,
  createOrphanSweepTarget,
  createCaptureAuditSink,
  runErasure,
  defineRetentionTask,
  AUTO_90D_SWEEP_TASK,
} from "@caisson/retention-runner";
import { createInMemoryQueue } from "@caisson/jobs";

const targets = [
  createObjectStorageTarget({ client: s3Client }), // real client is an injected seam
  createCascadeDbTarget({ client: pgClient }),
  createOrphanSweepTarget({ client: pgClient }),
];
const sink = createCaptureAuditSink(); // swap for the pg driver in prod

// One-shot: a CCPA request or an operator-triggered erasure.
await runErasure(
  { subjectId, tenantId, reason: "ccpa_request" },
  targets,
  sink,
);

// Recurring: the auto_90d sweep, enqueued on a JobQueue.
const queue = createInMemoryQueue([defineRetentionTask({ targets, sink })]);
await queue.enqueue(AUTO_90D_SWEEP_TASK, { subjectId, tenantId });
```

## Drivers

`createObjectStorageTarget` / `createCascadeDbTarget` / `createOrphanSweepTarget` each take an
**injected minimal client interface** (`purge` / `cascadeDelete` / `sweep`) — the real S3/pg client
is a documented seam, never a dependency of this package (no `aws-sdk`/`pg` added). `createCaptureTarget`
and `createCaptureAuditSink` are the in-memory drivers for tests + the framework-agnostic reference.

## Tests

`bun test packages/retention-runner/src` — per-target error isolation, the reason-tagged audit row,
`.strict()` rejection of an unknown field / bad reason, the injected-client reference targets, and
the `auto_90d` sweep task enqueuing + running on `createInMemoryQueue`.

> Rebuild-clean from a public reference (gridworkdigital's erasure shape) — pattern only, never
> ported code.

# ADR-0152 — `@caisson/retention-runner` scheduling: `@caisson/jobs` port + in-memory dev driver

Status: accepted · 2026-07-01 (Stage-2 Stream B, operator fork-lock) · implements the scheduling seam
of ADR-0135's erasure runner · builds under ADR-0150. Append-only; supersede with a later ADR, never
edit.

## Context

ADR-0135 locks `@caisson/retention-runner` as pluggable multi-store erasure (object-storage purge →
cascade DB delete → orphan sweep → reason-tagged audit row) with per-target error isolation, but
leaves _how the recurring `auto_90d` sweep is driven_ open. The Stream B SPEC surfaced three options:
`@caisson/jobs` port (rec), an internal cron, or no scheduler. The operator locked the **`@caisson/jobs`
port + in-memory dev driver**.

## Decision

1. **The recurring `auto_90d` sweep is a `defineTask` on the `@caisson/jobs` `JobQueue` port.** Dev/test
   use the shipped in-memory/synchronous driver (`createInMemoryQueue`) — enqueue validates the
   Zod-`.strict()` payload then awaits the handler, so a unit test asserts "the sweep enqueued and ran"
   with no daemon. The production driver is **Trigger.dev** (the same seam `jobs` already documents),
   wired later — enqueuing callers never change.
2. **`ccpa_request` and `operator_manual` erasures call `runErasure()` directly** — they are
   operator/subject-triggered, one-shot, not scheduled; routing them through the queue would add
   nothing.
3. **`runErasure(request, targets)`** runs every `ErasureTarget` with per-target error isolation (an
   `allSettled` shape — one failing store never aborts the run), collects per-target outcomes, then
   writes **one** reason-tagged (`auto_90d` | `ccpa_request` | `operator_manual`) **plain-Postgres**
   audit row via an injected sink (in-memory driver in tests; the pg driver is a documented seam, no
   new dep per ADR-0150). Per ADR-0135 this row is audit-_logging_, **not** WORM.

## Why

- **Reuse the shipped `jobs` port** — it already owns typed-payload validation, the in-memory test
  driver, and the Trigger.dev prod seam; an internal `setInterval`/cron would reinvent all of it and
  add a scheduling surface to maintain.
- **Direct call for one-shot erasures** — a CCPA request is a synchronous operator action; the queue is
  for the _recurring_ sweep only.
- **Zero new deps** — the queue port, the erasure-target port, and the audit sink are all injected;
  real S3/pg drivers are seams, holding ADR-0150's single-install invariant.

## Rejected

- **Internal cron/`setInterval` inside the package** — rejected; reinvents `@caisson/jobs`.
- **No scheduler (expose `runErasure()` only)** — rejected; the operator wants the recurring `auto_90d`
  path first-class, not left to every caller to wire.

## Relations

Implements ADR-0135 (erasure runner). Composes ADR-0018 (`@caisson/jobs` `JobQueue` port + Trigger.dev
seam) and ADR-0007 (integer units). Builds under ADR-0150. Explicitly **not** an `audit-worm`/
audit-chain upgrade (ADR-0135 Genericness).

## Binding

`@caisson/retention-runner` drives the recurring `auto_90d` sweep as a `@caisson/jobs` task (in-memory
dev driver, Trigger.dev prod seam); `ccpa_request`/`operator_manual` call `runErasure()` directly; the
run writes one reason-tagged plain-Postgres audit row via an injected sink, with per-target error
isolation and zero new deps. Changing the scheduling mechanism requires a superseding ADR.

Evidence: `docs/state/stage2-stream-b-spec.md` §B3 + Fork 3; `packages/jobs/src/queue.ts`; the
2026-07-01 operator fork-lock.

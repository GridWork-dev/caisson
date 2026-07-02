# ADR-0205 — @caisson/jobs grows the consumer side: idempotent enqueue, claim API, visibility ledger

**Status:** accepted · 2026-07-02 (harvest slice-2 wave, ADR-0204 scope lock).
**Relates:** ADR-0018 (jobs port), ADR-0173 (pg-boss driver — names `singletonKey` as the deferred D6
lift), ADR-0133 (Wardfile B1 typed-queue lift), lift-sweep #14 (glossread idempotent polyglot job-queue seam).

## Context

`@caisson/jobs` is a producer-only enqueue wrapper today: 3 interchangeable drivers (pg-boss, Trigger.dev,
in-memory) behind a Zod-typed task contract with a port-conformance harness. The harvest intent's three
hardest items — idempotent upsert-in-tx enqueue, SKIP LOCKED claim semantics, and a visibility ledger —
all live on the consumer/worker side, which no Caisson code owns or tests. The operator chose to build,
not defer.

## Decision

1. **Idempotent enqueue:** `enqueue()` gains an `idempotencyKey` option across all 3 drivers (pg-boss
   `singletonKey`; Trigger.dev `idempotencyKey`; in-memory keyed map). Conformance rule: double-enqueue
   with the same key yields one job.
2. **Claim/worker API:** the port gains a typed consumer surface. SKIP LOCKED semantics are _surfaced from
   pg-boss's native `work()`_, never hand-written SQL; Trigger.dev maps to `task()` registration;
   in-memory polls. Handlers Zod-parse payloads at the boundary.
3. **Visibility ledger:** the smallest honest version — a typed ledger-read API exposing driver job-state
   introspection (active/failed counts, per-job state) rather than a parallel lease table. A real lease
   table is explicitly out of scope until a consumer needs leases the driver cannot answer.

## Rejected

- **Hand-written SKIP LOCKED claim SQL** — pg-boss already owns a correct, maintained claim path; owning a
  parallel one is liability without capability.
- **A new lease/visibility table** — invents state the drivers already track; revisit only on a concrete
  consumer need.
- **Defer the whole consumer side** — was the recommendation; operator locked build-now (ADR-0204 §2).

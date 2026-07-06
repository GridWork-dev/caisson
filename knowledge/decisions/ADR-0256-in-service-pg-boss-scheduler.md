# ADR-0256 — First in-repo recurring-task scheduler: pg-boss inside services/license, inert until armed

**Status:** accepted · 2026-07-06 (Kickoff-E SHIP-audit picker — the code review's
sweep-never-scheduled finding). Extends ADR-0252 (the expiry sweep + T-30d notice tasks this
schedules) and ADR-0018 (the jobs seam). Append-only; supersede with a later ADR, never edit.
**Tags:** none at lock; the build inherits `billing`.

## Decision

1. **`services/license` registers the two ADR-0252 tasks on a pg-boss queue at boot** — the
   first in-repo recurring-task scheduler (until now every recurring task was a deploy-surface
   act, the retention-runner precedent). pg-boss (already a shipped `@caisson/jobs` driver) is
   Postgres-backed: no new service, no new infra, and the task wrappers' per-account
   `singletonKey` dedup already guards double-enqueue.
2. **Inert until armed** (the aeo-probe idiom): a `CREDIT_EXPIRY_SCHEDULE` env (cron expression)
   arms it; unset = the scheduler never starts and the service behaves exactly as today. The
   operator arms it at the next DEPLOY alongside migrations 0014–0016.
3. **A daily parent tick enumerates accounts** (`SELECT DISTINCT account_id FROM credit_wallet`)
   and enqueues the per-account sweep + notice jobs. The notice task's emailer stays
   driver-gated (ADR-0252 posture): no email driver configured = the notice sweep records
   nothing sent and the sweep still burns residue.

Rejected: **deploy-surface only** — leaves a money-visible correctness gap (unswept residue
inflates the displayed balance) to manual ops forever; **a dedicated cron service** — a new
deploy unit + env surface for two daily ticks.

## Consequences

- The launch-runbook DEPLOY row gains "set `CREDIT_EXPIRY_SCHEDULE`" next to the 0014–0016
  migration apply (tracked in `docs/state/outstanding-work.md` §1).
- pg-boss creates its own schema/tables in the license database on first arm — an additive,
  self-managed bootstrap, not a numbered deploy-migrate entry (it is pg-boss's own versioned
  surface, never hand-edited).

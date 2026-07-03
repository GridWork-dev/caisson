# ADR-0229 — Wave-6 harvest disposition: build the compliance/billing subset as one set, roadmap the rest

**Status:** accepted · 2026-07-03 (fourth picker round, operator-locked). Extends **ADR-0210 §3–4**
(lift-harvest slice-2 wave lock — which PARKED the sub-top-15 wave-6 residual "per program
ordering") and dispositions the bucket that
`outputs/specs/deferred-respec/SPEC-wave6-harvest-disposition.md` enumerated. Append-only;
supersede with a later ADR, never edit.
**Tags:** `billing`, `security`.

## Context

The lift-sweep residual parked by ADR-0210 is not "~22" rows — the SPEC's enumeration against the
source-C report (`caisson-lift-sweep-REPORT.md`) totals **67 distinct candidates**, split by the
SPEC's per-row table into **19 build-next · 28 build-on-trigger · 20 drop-with-reason**. Leaving
the bucket undispositioned risked silently dropping real compliance/billing hardening (the SPEC's
own trigger).

## Decision

Operator lock: **build the compliance/billing subset — SPEC rows 8, 9, 10, 44, 50, 51, 54, 56, 57,
59 — as ONE spec/workflow/PR set**; everything else in the table goes **roadmap-only** (the
remaining build-next rows demote to build-on-trigger dispositions; the drop rows stand with their
recorded reasons). The ten committed rows:

| Row | Item                                                                                    | Size | Sink                        |
| --- | --------------------------------------------------------------------------------------- | ---- | --------------------------- |
| 8   | Sentry PHI/secret scrubber (TS snake+camelCase key matcher)                             | S    | compliance evidence         |
| 9   | Policy-to-code ADR traceability idiom (ADR-in-docstring + `policy_version` golden rows) | XS   | compliance evidence         |
| 10  | Canonical-JSON + SHA-256 content hash (frozen-claim integrity)                          | XS   | audit-chain                 |
| 44  | Constant-time secret/admin verification wrapper (hash-both-sides `timingSafeEqual`)     | XS   | auth / security.md rule     |
| 50  | Idempotent credits ledger (UNIQUE event id + FOR UPDATE + drain-order)                  | M    | billing/credits             |
| 51  | Dual-layer billing-webhook idempotency (outer event-table + per-side-effect keys)       | M    | billing (converges with 50) |
| 54  | Read-only-mode mutation gate (`assertNotReadOnly`)                                      | XS   | kernel/tenancy fail-closed  |
| 56  | Scheduler `max_instances=1` / `coalesce` overlap-safety default                         | XS   | jobs                        |
| 57  | Race-free deduplicated queue via Postgres advisory xact lock (composes with ADR-0211)   | S    | jobs                        |
| 59  | Cron/internal-worker bearer auth (constant-time, fail-closed)                           | XS   | jobs/background triggers    |

Delivery shape: one build SPEC + one workflow-orchestrated EXECUTE + one PR (subset is
tree-coherent: compliance evidence + billing/credits idempotency + jobs safety + two auth
primitives). Model routing per `identity/doctrine.md` lanes; fable only for the money/crypto
verdicts.

## Consequences

- The wave-6 bucket is dispositioned — nothing in it is silently dropped (the SPEC's goal).
- The 10-row build set closes real SOC2/HIPAA evidence + billing-idempotency gaps before launch.
- The 57 non-picked rows carry an explicit roadmap/drop disposition in the SPEC's table; any
  later build cites this ADR and the row number.

# ADR-0281 — PostgreSQL required: no MySQL lane

**Status:** accepted · 2026-07-07 (operator-locked, fifth sitting — the Spike M fork).
Grounded in the MySQL-compat scoping spike
(`outputs/research/prelaunch-fanout-2026-07/followups/mysql-compat-spike-2026-07-07.md`).
Append-only; supersede with a later ADR, never edit. **Tags:** `security`.

## Context

The spike classified all 61 workspace projects: the tenant-isolation seam is Postgres
Row-Level Security (`FORCE ROW LEVEL SECURITY` + `withTenant()`/`TenantExecutor`,
ADR-0005) on every multi-tenant table, and every "convenience-bound" package trusts that
floor rather than carrying isolation logic of its own. MySQL 8 has no native RLS. The
consequence is structural: there is no phaseable partial port — a MySQL lane first requires
an app-layer isolation redesign (~6–10 engineer-weeks) that is strictly WEAKER than the
DB-enforced guarantee shipped today (a forgotten `WHERE account_id` filter returns zero rows
under RLS; an app-layer wrapper only holds if every query in every package routes through it
forever). The Drizzle/Prisma bridges (ADR-0266) are query-surface conveniences on the pg
dialect, not database-engine abstractions. The local-first family (`local-store`,
`local-sync`, `local-ai`) is embedded SQLite and orthogonal to this question.

## Decision

**PostgreSQL is required and stays required. Tenant isolation remains DB-enforced RLS. No
MySQL lane is planned.** The buyer-facing answer is the honest stack-fit surface (Track S
`/stack-fit`: the per-module Postgres/SQLite/no-DB posture table + the "MySQL / other RDBMS:
not supported" row) — the spike's scenario (a). Scenarios (b)/(c) are rejected as scoped:
revisiting is demand-driven only, via a later ADR that must name the weaker isolation
posture explicitly.

## Consequences

- Sales/marketing copy never hedges on this: Postgres-required is stated as a security
  property, not an apology (the isolation guarantee is the product).
- The stack-fit drift-pin test keeps the posture table honest as modules are added.
- A future MySQL request gets pointed at the spike doc + this ADR instead of re-litigating.

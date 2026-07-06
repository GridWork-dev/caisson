# ADR-0266 — ORM adapter family: Drizzle bridge + Prisma adapter for tenancy-rls

**Status:** accepted · 2026-07-06 (Kickoff-F picker round 4, dx-demos-compat session).
One ADR per port-family (adapter-expansion convention). **Amends ADR-0014 IN PART:** Prisma
stays rejected for Caisson's OWN app code; buyer-facing adapter support is a distinct
question this ADR answers yes. Port contract unchanged (ADR-0003/0108 — never a port fork).
Append-only. **Tags:** security (tenancy-rls is an RLS boundary seam).

## Decision

1. **Drizzle bridge:** the documented `.toSQL()` → `{sql, params}` pattern — Drizzle's
   query builder emits exactly the node-postgres shape `TenantExecutor.query()` already
   takes — plus one small convenience helper and a round-trip test inside the **unmodified**
   `withTenant` contract. No new dependency, no port change (~100–200 LOC + docs). The
   drizzle-kit gap is documented as a buyer gotcha: drizzle-kit cannot emit
   `FORCE ROW LEVEL SECURITY` (open drizzle-team PR #5843) — Caisson's raw-SQL migrations
   stay canonical for RLS DDL.
2. **Prisma adapter too** (operator pick above the Drizzle-only rec): a documented bridge
   over `$queryRawUnsafe`/`$executeRawUnsafe` + interactive `$transaction` (shape-compatible
   with `TenantExecutor`), using the driver-adapter mode (`@prisma/adapter-pg`, no engine
   binary — verify at build), with its **own conformance suite** mirroring the
   email/kms-conformance pattern and a documented `schema.prisma` authoring convention.
   File placement (sibling helper in tenancy-rls vs docs-first example) is build-owned.
3. Both adapters run the port-conformance + round-trip tests; RLS enforcement is asserted
   through each bridge (a tenant-isolation test per adapter, not just shape parity).

Rejected: **Drizzle-only** (operator pick overrode — widest ORM coverage chosen);
**building a Transactor on top of `db.transaction()`** (Drizzle's tx callback hides the
PoolClient — Caisson's own apps/site/lib/db.ts comment already documents this dead end).

## Consequences

- Prisma enters as a dependency of the adapter surface only — Caisson's own apps stay
  Drizzle/raw-SQL (ADR-0014 posture for first-party code intact).
- Each adapter lands a live/conformance row in the ADR-0265 checklist (PGlite/integration
  legs suffice; no external creds).
- The adapter docs state plainly that RLS policies/migrations remain raw-SQL artifacts —
  ORM schema tools do not own the security DDL.

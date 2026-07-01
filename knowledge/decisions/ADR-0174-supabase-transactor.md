# ADR-0174 — DB adapter: explicit Supabase driver behind the `Transactor` port (TCP-transaction constraint)

**Status:** accepted · 2026-06-30 (Stage-2 Stream D, adapter buildout) · extends ADR-0005 (fail-closed RLS) /
ADR-0014 (Drizzle) / ADR-0115 (Railway PG default, TCP-tx requirement) · realizes
`docs/state/adapter-expansion.md` Tier-3 DB row (advisory number retires → 0174). Append-only.

## Context

`packages/tenancy-rls` defines the `Transactor` seam and `withTenant(db, accountId, fn)` (`rls.ts:21,31`) — the
sole RLS entry, which opens a **transaction-scoped** connection and `SET LOCAL` the tenant policy. Today the DB
is injected: node-postgres/Neon (prod), PGlite (test), sqlite (local-first). Buyers on Supabase have no
first-class driver.

## Decision

Add an **explicit Supabase** `Transactor` driver (a thin `drizzle-orm/node-postgres` wiring against Supabase's
**session-mode pooler**, injected config). The binding constraint, called out loudly: `withTenant`'s
`SET LOCAL` RLS model **requires real TCP transactions** — the same reason the platform moved to Railway PG over
an HTTP driver (ADR-0115). The Supabase driver therefore targets the session-mode pooler / direct connection,
**never** the transaction-mode pooler or a serverless-HTTP path (which cannot hold a `SET LOCAL` across the
tenant callback). Fail-closed if the connection cannot start a transaction.

## Scope — build-now vs DEPLOY-class

**Build now:** the Supabase driver factory + a conformance test asserting `withTenant` runs a real transaction
(reuse the PGlite RLS test shape). **DEPLOY-class:** the buyer's Supabase connection string.

## Rejected

- **Neon serverless-HTTP driver** — incompatible with the transaction-scoped `withTenant` model (the ADR-0115
  rationale); only the TCP path is sound.
- **Auto-detecting pooler mode** — the ADR pins session-mode explicitly; silent transaction-mode selection
  would break RLS non-obviously.

## Binding

`Transactor` gains an explicit Supabase driver over the session-mode/TCP path only; serverless-HTTP DB drivers
are rejected for the RLS model. Adding another TCP-transactional driver needs no new ADR.

Evidence: `packages/tenancy-rls/src/rls.ts:21,31-47`; ADR-0115; `docs/state/adapter-expansion.md:46,109-110`;
recon `wf_fa542371-7e6` (D4 — `withTenant` opaque-account_id + TCP-tx).

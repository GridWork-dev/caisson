# ADR-0115 — Railway Postgres as the platform DB host

Status: accepted · 2026-06-30 (operator lock — closes the **dashboard DB-host fork**; amends the Neon
default of ADR-0014.)

The Caisson **platform** Postgres host (the seller-side DB behind the dashboard, license issuer,
entitlement store, credit ledger, and webhook grant path) is **Railway managed Postgres**, co-located
with the Railway app (ADR-0114) + the `services/docs`/`services/support-bot` services in project
`caisson-prod`. This replaces **Neon** as the default `DATABASE_URL` target. The driver is
**`drizzle-orm/node-postgres`** (already in the ADR-0014 matrix) over a normal TCP/pooled connection —
full transactions, so the fail-closed RLS `withTenant` (`SET LOCAL ROLE app` + `set_config`) pattern
works natively.

## Why

With the whole platform consolidating onto Railway as one Node app (ADR-0114), a co-located managed
Postgres is the lowest-latency, single-vendor, single-bill option: no cross-vendor egress, the same
datacenter as the app + services, and TCP transactions with zero workerd/edge bundling friction (the
constraint that drove ADR-0114). The Postgres-generic `TenantExecutor`/`Transactor` seam
(`packages/tenancy-rls/src/rls.ts:12-23`) and the one-Drizzle-schema / three-driver design make the host
a **connection-string choice**, not a code change — the swap is config only.

## Scope — what changes, what does NOT

**Changes:** the default platform `DATABASE_URL` points at Railway Postgres; prod runs the
`drizzle-orm/node-postgres` driver (not `neon-http`/`neon-serverless`).

**Unchanged (all of ADR-0014 except the host name):**

- One Drizzle schema; **PGlite** stays the test/dev driver (ADR-0013); `node-postgres` for any local
  Postgres. RLS, `SET LOCAL`, `SET ROLE` behave identically across drivers.
- Migrations stay **numbered, forward-only, idempotent** with the `schema_version` checksum ledger; RLS
  policies ship **inside** each tenant table's migration (ADR-0005).
- `DATABASE_URL` is **never hardcoded** — a buyer's shipped app still points it anywhere (Neon, RDS,
  Supabase, local). Railway Postgres is the _operator's platform default_, not a buyer requirement.

## Tradeoffs (recorded — operator chose one-vendor simplicity)

- **Loses Neon database branching** — ADR-0014 used per-PR ephemeral Neon branches for the fail-closed-RLS
  CI job. That CI job now runs on **PGlite** (already the test driver, deterministic, zero-provision) or
  a disposable Railway DB; the per-PR-real-Postgres-branch convenience is gone. Acceptable: PGlite +
  `SET LOCAL`/RLS parity already backs the suite.
- **Loses scale-to-zero** — Railway Postgres is an always-on managed instance (cost floor) vs Neon's
  scale-to-zero free tier. Acceptable for a platform DB that the dashboard/commerce spine keeps warm.
- **Operator owns backups** — Railway PITR/backups must be configured (vs Neon's managed branching/PITR).
  Tracked in the deploy runbook.

## Relations

- **Amends ADR-0014** — the platform reference host: **Neon → Railway Postgres**. The ORM (Drizzle), the
  driver matrix, the migration strategy, the RLS-in-migration rule, and the swappable-`DATABASE_URL`
  clause are all unchanged. Neon remains a supported driver target (the matrix still lists
  `neon-http`/`neon-serverless`); it is no longer the default.
- Supports ADR-0114 (the Node server that makes TCP transactions available) and ADR-0005 (fail-closed
  RLS, which needs the per-request transaction the TCP driver provides).

## Build-now vs DEPLOY-class

**Buildable now:** code + migrations are host-agnostic; new tables (e.g. the `license_grant` store,
ADR-0113-adjacent) ship as numbered RLS migrations tested on PGlite. The prod driver selection is an
env/composition concern wired behind `DATABASE_URL`.

**DEPLOY-class (operator-gated):** provision the Railway Postgres instance in `caisson-prod`, set
`DATABASE_URL` on the app + license/webhook services, configure backups/PITR, run the migration set.
Runbook: `docs/state/p6-deploy-runbook.md`.

## Binding

The platform Postgres host is Railway managed Postgres via `drizzle-orm/node-postgres`; PGlite remains
the test driver; migrations + RLS-in-migration + checksum ledger are unchanged; `DATABASE_URL` is never
hardcoded. Moving the platform host again requires a superseding ADR; it does not require code changes
(connection-string only).

# ADR-0141 — business-admin: read-only cockpit + a dedicated admin-read RLS role

Status: accepted · 2026-06-30 (Stage-2 Stream A initiative SPEC, operator picker) · **opens the
ADR-0138 detail fork** ("the business-admin mutation surface + its RLS/audit posture") · **builds on
ADR-0005** (fail-closed RLS tenancy) and **ADR-0115** (Railway Postgres). Append-only; supersede with
a later ADR, never edit.

## Context

ADR-0138 §2b puts business admin — tenants / purchases / entitlements / credits over the Railway PG —
in the control-plane, "under the ADR-0005 fail-closed RLS contract", and leaves the mutation surface +
RLS/audit posture open. Recon (Stream A, `wf_a3f97716-bff`, `railway-pg-schema`) established the hard
constraint: **there is no cross-tenant read path in the codebase.** The sole entry to tenant data is
`withTenant(db, accountId, fn)` (`packages/tenancy-rls/src/rls.ts`), which sets the
`app.current_account` GUC, drops to the FORCE-RLS `app` role, and scopes every query to one tenant.
There is no BYPASSRLS pool, no admin role, no aggregate view. There is also **no `tenants`/`purchases`/
`accounts` table** — a tenant is a bare `account_id` string; tenant identity lives in better-auth's own
`user`/`session`/`account` tables (no typed reader today), and "purchases" are `entitlement_grant` rows
with `source_kind='one_time'`.

An operator cockpit needs to read **across** tenants — the exact thing the tenant-isolation model is
built to forbid.

## Decision

1. **Read-only cockpit first.** `apps/admin` business-admin views **read** tenants / purchases /
   entitlements / credits / licenses cross-tenant; **no writes.** The mutation surface (editing
   entitlements/credits, refunds, grants) + its audit trail is deferred to a later ADR.

2. **Cross-tenant reads go through a dedicated read-only `admin` Postgres role, not a BYPASSRLS
   superuser.** A `buildAdminReadPolicySql(table)` sibling is added to `@caisson/tenancy-rls` that emits,
   alongside each table's existing tenant-isolation policy, a **permissive `FOR SELECT` policy
   `USING (true)` granted only to a new `admin` role** (SELECT-only; no INSERT/UPDATE/DELETE grant). A
   `withAdminRead(db, fn)` seam opens a transaction and `SET LOCAL ROLE admin` (read-only), mirroring
   `withTenant`'s shape. RLS stays the single enforcement mechanism; the buyer `app` role is unchanged
   and still sees only its own tenant.

3. **Typed cross-tenant readers extend the `@caisson/platform-reads` columns-contract pattern** — the
   readers parse the owning package's DDL and fail the build on a schema rename (the anti-desync guard).
   Tenant identity is read from better-auth's `user` table via a new typed reader.

## Why

- **Read-only defers the highest-risk, least-validated half.** Mutation's value is real but unproven and
  blast-radius-heavy; a cockpit that only reads is shippable now and needs no audit-who (which is why
  ADR-0140 could pick CF-Access alone).
- **A scoped `admin` read role beats a BYPASSRLS superuser.** A superuser connection means any bug in
  the admin app has unbounded write reach across every tenant. A SELECT-only role with explicit
  `USING(true)` policies keeps RLS the one mechanism, bounds the blast radius to reads, and needs no
  separate materialized view to keep in sync.
- **Fail-closed stays intact.** The tenant-isolation policies and the `app` role are untouched; the
  admin policy is additive and role-scoped, so a forgotten `withAdminRead` still sees nothing (no GUC,
  no role) — the ADR-0005 contract holds.

## Rejected

- **BYPASSRLS service/superuser role** — simplest, but an admin-app bug reaches every tenant's data with
  write privilege. Rejected: disproportionate blast radius for a read cockpit.
- **Materialized / aggregate admin view** — smallest table-access surface, but another schema to keep in
  sync and no clear win over role-scoped SELECT policies for the read shape needed here.
- **Mutation now** — deferred, not rejected forever; it returns as its own ADR with the audit surface.

## Confidence + revisit

**MEDIUM-HIGH** on read-only; **MEDIUM** on the role mechanism (no precedent in-repo — `@caisson/tenancy-rls`
has only single-tenant primitives today, so `buildAdminReadPolicySql`/`withAdminRead` are new and ship
with a FORCE-RLS fail-closed test proving the buyer `app` role still can't read cross-tenant). Revisit
when mutation is specced.

## Downstream

- Stream A A4: `buildAdminReadPolicySql` + `withAdminRead` in `@caisson/tenancy-rls`; cross-tenant typed
  readers (extend `@caisson/platform-reads`); a `user`-table tenant reader; `apps/admin/app/business/*`
  read views; PGlite-double empty-state when `DATABASE_URL` unset; a fail-closed cross-tenant test.
- Deploy session: create the `admin` Postgres role (SELECT grants) on the Railway PG; wire its DSN to
  `apps/admin` (distinct from the buyer `app` DSN).
- Future ADR: the mutation surface + audit trail (pairs with a better-auth operator role, ADR-0140 alt).

Evidence: recon `railway-pg-schema` (`wf_a3f97716-bff`); `packages/tenancy-rls/src/rls.ts`;
`packages/platform-reads/src/index.ts`; ADR-0005; ADR-0115; ADR-0138 §2b + §"Still open".

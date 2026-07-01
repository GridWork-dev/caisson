# @caisson/platform-reads — agent contract

Shared typed read-only queries over the `services/license` cross-service tables (`entitlement_grant` /
`license_grant`). Commercial base package. The home for any surface that needs to READ those tables
without importing the service's runtime.

## What it does

`entitlement_grant` and `license_grant` are owned by `@caisson/service-license` (a separately deployed
service) but shared in one Postgres. Surfaces like the buyer dashboard (`apps/site`) need to read them.
Rather than each surface hand-copying raw `SELECT` SQL — where a schema column rename silently desyncs
with no compiler signal — they import the typed reader here:

- `readEntitlementGrants(tx, accountId)` → `EntitlementGrantRow[]`
- `readLicenseGrantRows(tx, accountId)` → `LicenseGrantRow[]`

Each runs inside a `TenantExecutor` (`withTenant`, fail-closed RLS, ADR-0005). `timestamptz` columns
are normalized to ISO strings at the read boundary (driver returns `Date`).

## The contract test (the teeth)

`columns-contract.test.ts` imports the DDL constants `ENTITLEMENT_SCHEMA_SQL` / `LICENSE_GRANT_SCHEMA_SQL`
from `@caisson/service-license`, parses the declared column identifiers, and asserts every column the
readers touch (`ENTITLEMENT_GRANT_READ_COLUMNS` / `LICENSE_GRANT_READ_COLUMNS`) is present. A schema
rename now fails this test instead of desyncing at runtime.

## Boundaries

- Depends ONLY on `@caisson/tenancy-rls` (the `TenantExecutor` type). Never depends "up" on an edition
  (ADR-0003). `@caisson/service-license` is a test-only devDependency (schema DDL, down the schema
  layer) — never imported at runtime.
- Commercial (`LicenseRef-Caisson-Commercial`, `paid`): it reads commercial service table shapes, so it
  is NOT part of the open Apache Base substrate (ADR-0094/0097).

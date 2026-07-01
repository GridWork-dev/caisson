# @caisson/platform-reads

Shared typed read-only queries over the `services/license` cross-service tables. Commercial base package.

- **`readEntitlementGrants`** — every grant (active and revoked) for an account, newest first, from
  `entitlement_grant`.
- **`readLicenseGrantRows`** — the buyer's issued license grants from `license_grant`, newest major
  first.

These tables are OWNED by `@caisson/service-license` (a separately deployed service) but are READ by
other surfaces that share the one Postgres — first the buyer dashboard (`apps/site`). Importing the
typed reader here, instead of hand-copying the raw SQL, means a column rename in the service schema is
a **compile/test failure** — the `columns-contract.test.ts` parses the column identifiers out of the
shared DDL (`ENTITLEMENT_SCHEMA_SQL` / `LICENSE_GRANT_SCHEMA_SQL`) and asserts every column each reader
touches is present.

Leaf by design: depends only on `@caisson/tenancy-rls` for the `TenantExecutor` type (every read runs
inside `withTenant`, fail-closed RLS, ADR-0005). It does **not** import the service's query functions
or runtime — only the table shape.

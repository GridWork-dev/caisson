---
updated: 2026-09-24
status: live
grounds:
  - docs/deploy/STATE.md
  - docs/ops/incident-response.md
  - docs/operations.md
---

# Database restore procedure

The operative path is the logical `pg_dump`/`pg_restore` procedure in
[operations §9](../operations.md). It was rehearsed successfully on 2026-07-11 with full
row-count parity, including the requirement to recreate the `admin`, `admin_write`, `admin_app`,
and `app` roles before `pg_restore` so RLS policy creation succeeds.

That rehearsal is historical recovery evidence, not proof that today’s backup is recent. Verify
Railway snapshot recency before launch. Site migrations `0030`–`0032` have since been applied in
production — the chain ran 2026-07-27 taking `schema_version` 29 → 32 against a pg_restore-verified
backup, and the tag's pre-deploy re-ran it idempotently at 32 ([deploy state](../deploy/STATE.md)) —
so the no-receipt caveat this paragraph used to carry is retired. A restore drill for the release
that arms hosted field crypto must still
reapply the chain through `0032_field_crypto_keys.sql`, then receipt the restored
`field_key_version` and `field_wrapped_dek` rows, forced RLS and tenant policies, and append-only
wrapped-DEK triggers before running a real version-pinned Azure wrap/unwrap probe.

## Topology: one service, two application databases, one unused default

| Database     | Purpose                                                            |
| ------------ | ------------------------------------------------------------------ |
| `railway`    | platform and commerce data, including `intel` and `pgboss` schemas |
| `admin_auth` | isolated Better Auth database for admin GitHub OAuth               |
| `postgres`   | Railway-created default database; unused                           |

All three databases are on one Railway Postgres service. Restore scope must name the database;
“restore Postgres” is not a sufficiently precise instruction.

## Recovery sequence

1. Put the platform in read-only containment while selecting a recovery point.
2. Verify the dump, target database, roles, extensions, and rollback path.
3. Follow `docs/operations.md §9`; restore roles before schema/data.
4. Compare schema and row-count receipts for every expected schema.
5. Run tenant RLS, auth, entitlement, billing, jobs, intel, and admin-auth probes.
6. Lift read-only mode only after verification.

Read-only mode buys investigation time; it does not restore data. A code rollback and a data
restore are separate operations and an incident can require both.

Railway PITR remains trigger-parked. Its former evaluation is reference-only at
`docs/archive/db-restore-pitr-reference-2026-07-13.md`.

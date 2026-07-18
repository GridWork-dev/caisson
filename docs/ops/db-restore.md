---
updated: 2026-07-18
status: live
grounds:
  - docs/deploy/STATE.md
  - docs/ops/incident-response.md
  - docs/operations.md
---

# Database restore procedure (CAISSON-52, doc half)

The operative, REHEARSED restore path is the logical `pg_dump`/`pg_restore` procedure in
`docs/operations.md` §9 — proven end-to-end with full row-count parity on all schemas, including
the roles-before-restore caveat (recreate admin/admin_write/admin_app BEFORE `pg_restore` or every
RLS `CREATE POLICY` fails). Railway native PITR was evaluated and **DECLINED** at the 2026-07-11
backup picker (daily snapshots + rehearsed logical restore instead) — Railway's native restore is
an in-place staged volume swap, never a rehearsal path. The PITR mechanics are kept as reference in
`docs/archive/db-restore-pitr-reference-2026-07-13.md` for if that fork reopens.

## Topology: ONE Postgres service, TWO databases

Confirmed (`docs/deploy/STATE.md`'s "Admin OAuth flip" entry, 2026-07-07-ish): `admin_auth` is a
**database** created with `CREATE DATABASE admin_auth` **on the Railway Postgres** — i.e. the
SAME Postgres service the commerce/platform data lives on, not a second Railway Postgres service.
Two logical databases, one physical server:

- the platform/commerce database (the service's default database, `DATABASE_URL`) — buyer
  accounts, entitlements, credits, billing.
- `admin_auth` (`ADMIN_AUTH_DATABASE_URL`) — better-auth's own tables for `apps/admin`'s GitHub
  OAuth sign-in, deliberately isolated from commerce (the config forbids reusing the site auth DB
  to avoid an `account` table collision — same STATE.md entry).

## Related

- **Restore procedure (the current one)** — `docs/operations.md` §9 (logical `pg_dump`/`pg_restore`).
- **PITR reference (declined path, kept for context)** — `docs/archive/db-restore-pitr-reference-2026-07-13.md`.
- **Code-level rollback** (a bad deploy, not a bad write) — `docs/ops/incident-response.md`
  §"Generic Railway rollback". A restore undoes DATA; a rollback undoes CODE — an incident may need
  either or both.
- **Read-only containment** — `packages/kernel/src/read-only.ts`'s `assertNotReadOnly` gate has
  been LIVE since ADR-0300 (2026-07-09, Kickoff-H W3, an admin-flipped `system_mode` source). Can
  freeze writes while a restore target is being decided — see `docs/ops/incident-response.md`.

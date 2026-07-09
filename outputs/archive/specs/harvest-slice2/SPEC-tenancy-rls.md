# SPEC — `@caisson/tenancy-rls` role pre-flight guard + RLS migration-equivalence harness

**Status: EXECUTED — ADR-0210 (wave lock; extends ADR-0005), harvest slice-2 wave, 2026-07-02 operator picker, shipped PR #47.**

- **Slice:** harvest slice-2, items #8 (2nd half — role guard) + #7 (2nd half — migration equivalence).
- **Package:** `@caisson/tenancy-rls` (Base, Apache-2.0, ADR-0094/0097) + `tooling/standards-gate` (harness home, `private: true`).
- **Type:** HARDEN. **Tags:** `security`.

## Goal (WHAT + WHY)

Two half-closed gaps in the fail-closed RLS story (ADR-0005). (1) `withTenant`/`withUser` trust the `app` role they `SET LOCAL ROLE` into is genuinely unprivileged — a misconfigured role (SUPERUSER/BYPASSRLS) silently no-ops `FORCE ROW LEVEL SECURITY` and reopens the cross-tenant leak, with zero runtime signal. (2) `buildTenantPolicySql` is the canonical RLS-SQL generator, but nothing checks hand-written migration RLS against it — `retention_audit` (0002) and `alert_audit_log` (0001) already ship narrower GRANTs than the generator would, undocumented: live, undetected drift. Both close the same bug class — a table LOOKS tenant-isolated but isn't provably so.

## Scope

**In:**

- A one-time, cached, fail-closed role pre-flight check wired into `withTenant`/`withUser`.
- A static standards-gate check that discovers tenant tables across every package's `src/migrations/*.sql`, verifies each table's hand-written RLS against `buildTenantPolicySql` output, and requires an explicit override for any narrower-than-generated (but still fail-closed) GRANT.

**Out:**

- Parameterizing the hardcoded `SET LOCAL ROLE app` literal (unrelated refactor).
- A live tool that ALTERs roles — read-only check only.
- Flagging non-tenant tables — scope stays "has an `account_id`/`tenant_id` column".
- Editing the byte-checksummed migration files already shipped (ADR-0006 append-only + `@caisson/migrate`'s checksum-drift-fail-closed) — the override lives in a side file, never in migration SQL.

## Design

- **Role guard (`packages/tenancy-rls/src/rls.ts`):** `async function assertRoleNotPrivileged(tx: TenantExecutor, role: string): Promise<void>` runs `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1`; throws `TenancyError` (never warns) if the row is absent, `rolsuper`, or `rolbypassrls`. Cached per-`Transactor` instance via module-level `const roleGuardChecked = new WeakSet<Transactor>()` — runs once, on the first `withTenant`/`withUser` call for a given `db`, inside that call's transaction, before `SET LOCAL ROLE app`. A failed check is never cached, so a fixed misconfig un-wedges on the next call with no restart. Both functions call it with the `"app"` literal they already hardcode for `SET LOCAL ROLE`.
- **Equivalence harness (`tooling/standards-gate/src/checks.ts`):** new `checkRlsEquivalence(pkgs: Pkg[], root: string): Finding[]`, wired into `cli.ts`'s findings array. Per package with `src/migrations/*.sql`: concatenate files in filename order; regex-extract every `CREATE TABLE` with an `account_id`/`tenant_id` NOT NULL column → tenant-table candidates; regex-extract every RLS block (`ALTER TABLE t ENABLE/FORCE ROW LEVEL SECURITY` … `CREATE POLICY …_tenant_isolation ON t …;`) keyed by table, capturing its GRANT set, GRANT role, and USING column. No captured block → **error** `rls-missing`. A block found → render `buildTenantPolicySql(table, { column, role })` (import the real function — gate and generator can't independently drift) and whitespace-normalize-compare: ENABLE/FORCE/USING/WITH-CHECK must match exactly; the actual GRANT set must equal the rendered full-CRUD set, OR be a proper subset AND listed in `tooling/standards-gate/rls-equivalence-overrides.json` (`{table, package, reason}[]`) — any other divergence is **error** `rls-equivalence`. Overrides file ships pre-seeded with the 6 known legitimate narrow-grant tables: `retention_audit`, `alert_audit_log`, `locked_version`, `field_key_version`, `field_wrapped_dek`, `impersonation_session`. _Build amendment (task-4 live gate): the real run surfaced a 7th — `audit_chain_entry` (`@caisson/audit-worm`), hash-chained WORM append-only exactly like `locked_version` in the same package; the shipped overrides file carries all 7._

## Tasks (for PLAN)

1. `assertRoleNotPrivileged` + `WeakSet` cache in `rls.ts`, wired into `withTenant` + `withUser`; two PGlite tests in `rls.integration.test.ts` (`ALTER ROLE app SUPERUSER` → `withTenant` rejects `TenancyError`; `ALTER ROLE app BYPASSRLS` → same), confirming the 5 pre-existing tests still pass. Verify: `cd packages/tenancy-rls && bun test src`.
2. `tooling/standards-gate/rls-equivalence-overrides.json` seeded with the 6 known tables. Verify: `bun -e "JSON.parse(await Bun.file('tooling/standards-gate/rls-equivalence-overrides.json').text())"`.
3. `checkRlsEquivalence` in `checks.ts` + wire into `cli.ts`. Fixtures in `checks.test.ts`: missing-RLS tenant table → `rls-missing`; exact match → clean; unlisted narrow grant → `rls-equivalence`; listed narrow grant → clean. Verify: `cd tooling/standards-gate && bun test src/checks.test.ts`.
4. Run the real gate against the live repo; confirm the 6 overrides suppress false positives and nothing else newly flags. Verify: `bun run tooling/standards-gate/src/cli.ts` exits 0 (no new errors vs current baseline).
5. Changeset naming `tenancy-rls` (patch) + `standards-gate` (patch).

## Verify (goal-backward)

- A role holding SUPERUSER or BYPASSRLS can no longer silently run `withTenant`/`withUser` — it throws before touching data, closing the reopened ADR-0005 leak.
- The guard costs at most one extra catalog query per distinct `Transactor` instance, not per transaction.
- `checkRlsEquivalence` catches the `retention_audit`-class drift by construction: a tenant table whose hand-written RLS narrows the GRANT without a listed reason fails the gate.
- The 6 currently-shipped legitimate divergences pass clean (zero false-positive noise day one).
- `bun run check` (root) and the standards-gate CLI both stay green on the existing tree.

## Effort: S (~0.5–1 day). Value: MEDIUM — closes two provable-but-latent holes in the tenancy-isolation guarantee every commercial edition sells on top of; no new package, no new SKU.

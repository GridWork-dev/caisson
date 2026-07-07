// @caisson/platform-reads — the shared typed read layer over the services/license cross-service
// tables (`entitlement_grant` / `license_grant`). These tables are OWNED by `services/license`
// (`@caisson/service-license`, a separately deployed service) but are READ by other surfaces that
// share the one Postgres — first the buyer dashboard (apps/site). Those surfaces know the table
// SHAPE, not the service's business logic, which is the smaller, more honest coupling between two
// independently deployable surfaces.
//
// THE FIX (extracted from apps/site/lib/dashboard-reads.ts): the raw SELECT SQL used to be
// hand-copied in apps/site, so a column rename in `services/license`'s schema silently desynced the
// app's queries with no compiler signal. Now the SELECT column lists live here as exported constants
// (`ENTITLEMENT_GRANT_READ_COLUMNS` / `LICENSE_GRANT_READ_COLUMNS`) and the columns-contract test
// (`columns-contract.test.ts`) parses the column identifiers out of the shared DDL
// (`ENTITLEMENT_SCHEMA_SQL` / `LICENSE_GRANT_SCHEMA_SQL` from `@caisson/service-license`) and asserts
// every column these readers touch is present — so a schema rename is now a TEST failure here, not a
// runtime desync there.
//
// Leaf by design: depends only on `@caisson/tenancy-rls` for the `TenantExecutor` type (every read
// runs inside `withTenant`, ADR-0005 fail-closed RLS). It does NOT import the service's query
// functions or runtime — only the table shape, expressed as typed reads + the column contract.
import type { TenantExecutor } from "@caisson/tenancy-rls";

/** `timestamptz` columns come back as a driver-native `Date` instance on both PGlite and
 * node-postgres, never a string — normalize explicitly at every raw-SQL read boundary rather than
 * trust the declared row type (mirrors the fix in `@caisson/credits#getLedger`). */
function toIsoString(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function toIsoStringOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : toIsoString(value);
}

/**
 * The `entitlement_grant` columns these reads depend on (the SELECT list plus `account_id`, the RLS
 * scope predicate). Exported so the columns-contract test can assert every one is present in
 * `@caisson/service-license`'s `ENTITLEMENT_SCHEMA_SQL` — a rename in either place breaks the test.
 */
const ENTITLEMENT_GRANT_SELECT_COLUMNS = [
  "entitlement_id",
  "source_kind",
  "status",
  "granted_at",
] as const;

export const ENTITLEMENT_GRANT_READ_COLUMNS = [
  "account_id",
  ...ENTITLEMENT_GRANT_SELECT_COLUMNS,
] as const;

export interface EntitlementGrantRow {
  entitlementId: string;
  sourceKind: "subscription" | "one_time";
  status: "active" | "revoked";
  grantedAt: string;
}

/** Every grant (active AND revoked) for the account, newest first — the Overview view's source. */
export async function readEntitlementGrants(
  tx: TenantExecutor,
  accountId: string,
): Promise<EntitlementGrantRow[]> {
  const r = await tx.query<{
    entitlement_id: string;
    source_kind: "subscription" | "one_time";
    status: "active" | "revoked";
    granted_at: unknown;
  }>(
    `SELECT ${ENTITLEMENT_GRANT_SELECT_COLUMNS.join(", ")}
     FROM entitlement_grant
     WHERE account_id = $1
     ORDER BY granted_at DESC`,
    [accountId],
  );
  return r.rows.map((row) => ({
    entitlementId: row.entitlement_id,
    sourceKind: row.source_kind,
    status: row.status,
    grantedAt: toIsoString(row.granted_at),
  }));
}

/**
 * `readUpdatesWindows`'s extra `entitlement_grant` column beyond `ENTITLEMENT_GRANT_SELECT_COLUMNS`:
 * `updates_expires_at` is added by a separate ALTER TABLE migration
 * (`ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL` in `@caisson/service-license`), not the base
 * `ENTITLEMENT_SCHEMA_SQL` CREATE TABLE the columns-contract test's DDL parser covers — so this
 * column isn't asserted there; `updates-window.integration.test.ts` exercises the live column
 * directly on PGlite instead.
 */
export const UPDATES_WINDOW_READ_COLUMNS = [
  ...ENTITLEMENT_GRANT_READ_COLUMNS,
  "updates_expires_at",
] as const;

/**
 * Mirrors `services/license`'s `computeUpdatesWindows` EXACTLY (ADR-0244/0255: same table, same
 * one_time-only sourcing, same purchased-id keying, same most-favorable/max-bound fold) — the LIVE
 * read the buyer dashboard uses in place of decoding the last-issued license token, which goes
 * stale after a renewal extends the DB row without a re-issue. Returns a `purchasedEntitlementId ->
 * ISO instant` map; EMPTY when the account holds no active one-time grants (subscription-sourced
 * entitlements never get a key — their own license expiry governs, ADR-0244 §4). Run inside
 * `withTenant`.
 *
 * Deliberately does NOT import `@caisson/service-license`'s query function — the read is
 * re-expressed as raw SQL against the known table shape so this package stays a leaf (schema
 * coupling only, never the service's runtime).
 */
export async function readUpdatesWindows(
  tx: TenantExecutor,
  accountId: string,
): Promise<Record<string, string>> {
  const r = await tx.query<{ entitlement_id: string; bound: unknown }>(
    `SELECT entitlement_id,
            max(COALESCE(updates_expires_at, granted_at + interval '12 months')) AS bound
       FROM entitlement_grant
      WHERE account_id = $1 AND source_kind = 'one_time' AND status = 'active'
      GROUP BY entitlement_id`,
    [accountId],
  );
  const windows: Record<string, string> = {};
  for (const row of r.rows) {
    windows[row.entitlement_id] = toIsoString(row.bound);
  }
  return windows;
}

/**
 * The `license_grant` columns these reads depend on (the SELECT list plus `account_id`, the RLS
 * scope predicate). Exported so the columns-contract test can assert every one is present in
 * `@caisson/service-license`'s `LICENSE_GRANT_SCHEMA_SQL`.
 */
const LICENSE_GRANT_SELECT_COLUMNS = [
  "major",
  "license_id",
  "tier",
  "expiry",
  "token",
  "issued_at",
] as const;

export const LICENSE_GRANT_READ_COLUMNS = [
  "account_id",
  ...LICENSE_GRANT_SELECT_COLUMNS,
] as const;

export interface LicenseGrantRow {
  major: number;
  licenseId: string;
  tier: string;
  expiry: string | null;
  token: string;
  issuedAt: string;
}

/** The buyer's issued license grants (mirrors `license-grant-store.ts`'s row shape), newest major first. */
export async function readLicenseGrantRows(
  tx: TenantExecutor,
  accountId: string,
): Promise<LicenseGrantRow[]> {
  const r = await tx.query<{
    major: number;
    license_id: string;
    tier: string;
    expiry: unknown;
    token: string;
    issued_at: unknown;
  }>(
    `SELECT ${LICENSE_GRANT_SELECT_COLUMNS.join(", ")}
     FROM license_grant
     WHERE account_id = $1
     ORDER BY major DESC`,
    [accountId],
  );
  return r.rows.map((row) => ({
    major: row.major,
    licenseId: row.license_id,
    tier: row.tier,
    expiry: toIsoStringOrNull(row.expiry),
    token: row.token,
    issuedAt: toIsoString(row.issued_at),
  }));
}

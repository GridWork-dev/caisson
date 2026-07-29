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
 * `readNetPaidByItem`'s extra `entitlement_grant` columns. Like `updates_expires_at` above, all
 * three arrive by ALTER TABLE migration (`ENTITLEMENT_GRANT_CHARGED_AMOUNT_MIGRATION_SQL` and
 * `ENTITLEMENT_GRANT_REFUNDED_AMOUNT_MIGRATION_SQL` in `@caisson/service-license`) rather than the
 * base CREATE TABLE the columns-contract test's DDL parser covers, so they are asserted by
 * `net-paid.integration.test.ts` against the live columns on PGlite instead.
 */
export const NET_PAID_READ_COLUMNS = [
  ...ENTITLEMENT_GRANT_READ_COLUMNS,
  "charged_amount",
  "charged_currency",
  "refunded_amount",
] as const;

/** What one owned item's buyer actually paid, net of refunds. Structurally `@caisson/pricebook`'s
 * `PaidAmount` — this package stays a leaf and does not import the pricebook to say so. */
export interface NetPaidAmount {
  readonly amountMinorUnits: number;
  readonly currency: string;
}

/**
 * What the account has actually paid, per owned entitlement id, net of refunds (ADR-0382 lock 2 for
 * the charge, ADR-0394 for the netting) — the `paidByItem` producer for `@caisson/pricebook`'s
 * upgrade quote, which credits an owned item at `max(retail, paid)` so a later price CUT never
 * strands a buyer who paid the old higher number.
 *
 * Netting happens HERE, in SQL, because the alternative is a caller reading `charged_amount` raw and
 * crediting a buyer for money that went back to their card. `charged_amount` is stamped once and
 * never mutates; refunds accumulate in `refunded_amount`; the difference is what they are out of
 * pocket, floored at 0. `net-paid.integration.test.ts` pins this expression against
 * `@caisson/service-license`'s own `netCharged` so the two can never drift.
 *
 * ACTIVE grants only — a revoked grant is not owned, so it can never reach a quote. A NULL
 * `charged_amount` (the charge could not be attributed to a single SKU) yields NO key rather than a
 * zero: an omitted item credits at retail, and a zero would credit at nothing. Where one id has
 * several active grants, the LARGEST net charge wins, matching `readUpdatesWindows`'s
 * most-favorable-to-the-buyer fold directly above.
 *
 * Run inside `withTenant`. Throws if the migrations above have not been applied — deliberately, on a
 * money path: an absent column must not read as "this buyer paid nothing".
 */
export async function readNetPaidByItem(
  tx: TenantExecutor,
  accountId: string,
): Promise<Record<string, NetPaidAmount>> {
  const r = await tx.query<{
    entitlement_id: string;
    net_paid: number | string;
    charged_currency: string;
  }>(
    `SELECT DISTINCT ON (entitlement_id)
            entitlement_id,
            GREATEST(charged_amount - COALESCE(refunded_amount, 0), 0) AS net_paid,
            charged_currency
       FROM entitlement_grant
      WHERE account_id = $1
        AND status = 'active'
        AND charged_amount IS NOT NULL
      ORDER BY entitlement_id,
               GREATEST(charged_amount - COALESCE(refunded_amount, 0), 0) DESC`,
    [accountId],
  );
  const paid: Record<string, NetPaidAmount> = {};
  for (const row of r.rows) {
    paid[row.entitlement_id] = {
      amountMinorUnits: Number(row.net_paid),
      currency: row.charged_currency,
    };
  }
  return paid;
}

/**
 * The `subscription_status` columns these reads depend on (ADR-0293 G13/G14). Exported so the
 * columns-contract test can assert every one is present in `@caisson/service-license`'s
 * `SUBSCRIPTION_STATUS_SCHEMA_SQL`.
 */
const SUBSCRIPTION_STATUS_SELECT_COLUMNS = [
  "subscription_id",
  "price_id",
  "plan_tag",
  "status",
  "updated_at",
] as const;

export const SUBSCRIPTION_STATUS_READ_COLUMNS = [
  "account_id",
  ...SUBSCRIPTION_STATUS_SELECT_COLUMNS,
] as const;

export interface SubscriptionStatusRow {
  subscriptionId: string;
  priceId: string;
  planTag: string;
  status: "active" | "canceled";
  updatedAt: string;
}

/**
 * Every subscription-status row for the account, newest-updated first (ADR-0293) — the buyer
 * dashboard's G13 "owned" read for a zero-entitlement plan (Developer), and the G14 cancel route's
 * ownership + Paddle-subscription-id lookup. Deliberately does NOT import
 * `@caisson/service-license`'s query function — re-expressed as raw SQL against the known table
 * shape so this package stays a leaf. Run inside `withTenant`.
 */
export async function readSubscriptionStatuses(
  tx: TenantExecutor,
  accountId: string,
): Promise<SubscriptionStatusRow[]> {
  const r = await tx.query<{
    subscription_id: string;
    price_id: string;
    plan_tag: string;
    status: "active" | "canceled";
    updated_at: unknown;
  }>(
    `SELECT ${SUBSCRIPTION_STATUS_SELECT_COLUMNS.join(", ")}
       FROM subscription_status
      WHERE account_id = $1
      ORDER BY updated_at DESC`,
    [accountId],
  );
  return r.rows.map((row) => ({
    subscriptionId: row.subscription_id,
    priceId: row.price_id,
    planTag: row.plan_tag,
    status: row.status,
    updatedAt: toIsoString(row.updated_at),
  }));
}

/**
 * The `order_record` columns these reads depend on (ADR-0293 G26). Exported so the columns-contract
 * test can assert every one is present in `@caisson/service-license`'s `ORDER_RECORD_SCHEMA_SQL`.
 */
const ORDER_RECORD_SELECT_COLUMNS = [
  "source_event_id",
  "kind",
  "price_id",
  "label",
  "amount",
  "currency",
  "status",
  "created_at",
] as const;

export const ORDER_RECORD_READ_COLUMNS = [
  "account_id",
  ...ORDER_RECORD_SELECT_COLUMNS,
] as const;

export interface OrderRecordRow {
  sourceEventId: string;
  kind: "subscription" | "purchase";
  priceId: string | null;
  label: string;
  amount: number;
  currency: string;
  status: "paid" | "refunded";
  createdAt: string;
}

/** Every order/invoice row for the account, newest first (ADR-0293 G26) — the buyer dashboard's
 *  Invoices view. Run inside `withTenant`. */
export async function readOrderRecords(
  tx: TenantExecutor,
  accountId: string,
): Promise<OrderRecordRow[]> {
  const r = await tx.query<{
    source_event_id: string;
    kind: "subscription" | "purchase";
    price_id: string | null;
    label: string;
    amount: number;
    currency: string;
    status: "paid" | "refunded";
    created_at: unknown;
  }>(
    `SELECT ${ORDER_RECORD_SELECT_COLUMNS.join(", ")}
       FROM order_record
      WHERE account_id = $1
      ORDER BY created_at DESC`,
    [accountId],
  );
  return r.rows.map((row) => ({
    sourceEventId: row.source_event_id,
    kind: row.kind,
    priceId: row.price_id,
    label: row.label,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    createdAt: toIsoString(row.created_at),
  }));
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

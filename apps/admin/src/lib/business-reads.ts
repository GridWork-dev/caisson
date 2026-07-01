// Cross-tenant business-admin readers (ADR-0141). Each runs inside `readAdmin` (the read-only `admin`
// role), so a query with NO `WHERE account_id = …` returns EVERY tenant's rows — the operator view,
// the exact inverse of the buyer surface's per-tenant `withTenant` reads. Raw SQL against the tables
// owned by @caisson/credits + @caisson/service-license (the same deliberately-flagged cross-service
// coupling apps/site carries): the schema DDL is imported into the double (admin-db.ts) so a column
// rename fails the build, not silently at runtime.
import type { TenantExecutor } from "@caisson/tenancy-rls";

/** One tenant's business footprint — the operator's tenants overview. */
export interface TenantRow {
  accountId: string;
  creditBalance: number;
  entitlementCount: number;
  licenseCount: number;
}

/** An entitlement/purchase grant (a `one_time` row IS a purchase; `subscription` is recurring). */
export interface EntitlementRow {
  accountId: string;
  entitlementId: string;
  sourceKind: string;
  status: string;
  grantedAt: string;
}

export interface CreditRow {
  accountId: string;
  balance: number;
}

export interface LicenseRow {
  accountId: string;
  major: number;
  tier: string;
  expiry: string | null;
  issuedAt: string;
}

/**
 * The tenants overview: every account with any business state (credits ∪ entitlements ∪ licenses),
 * with its credit balance + active-entitlement + license counts. Derived from the business tables
 * (not better-auth's `user` table) so it stays self-contained; email enrichment is a DEPLOY follow-up.
 */
export async function readTenants(tx: TenantExecutor): Promise<TenantRow[]> {
  const { rows } = await tx.query<{
    account_id: string;
    credit_balance: number;
    entitlement_count: number;
    license_count: number;
  }>(
    `SELECT t.account_id,
            COALESCE(cw.balance, 0)          AS credit_balance,
            COALESCE(e.entitlement_count, 0) AS entitlement_count,
            COALESCE(l.license_count, 0)     AS license_count
       FROM (
         SELECT account_id FROM credit_wallet
         UNION SELECT account_id FROM entitlement_grant
         UNION SELECT account_id FROM license_grant
       ) t
       LEFT JOIN credit_wallet cw ON cw.account_id = t.account_id
       LEFT JOIN (
         SELECT account_id, COUNT(*)::int AS entitlement_count
           FROM entitlement_grant WHERE status = 'active' GROUP BY account_id
       ) e ON e.account_id = t.account_id
       LEFT JOIN (
         SELECT account_id, COUNT(*)::int AS license_count
           FROM license_grant GROUP BY account_id
       ) l ON l.account_id = t.account_id
      ORDER BY t.account_id`,
  );
  return rows.map((r) => ({
    accountId: r.account_id,
    creditBalance: Number(r.credit_balance),
    entitlementCount: Number(r.entitlement_count),
    licenseCount: Number(r.license_count),
  }));
}

export async function readEntitlements(
  tx: TenantExecutor,
): Promise<EntitlementRow[]> {
  const { rows } = await tx.query<{
    account_id: string;
    entitlement_id: string;
    source_kind: string;
    status: string;
    granted_at: string;
  }>(
    `SELECT account_id, entitlement_id, source_kind, status, granted_at
       FROM entitlement_grant
      ORDER BY granted_at DESC`,
  );
  return rows.map((r) => ({
    accountId: r.account_id,
    entitlementId: r.entitlement_id,
    sourceKind: r.source_kind,
    status: r.status,
    grantedAt: String(r.granted_at),
  }));
}

export async function readCredits(tx: TenantExecutor): Promise<CreditRow[]> {
  const { rows } = await tx.query<{ account_id: string; balance: number }>(
    `SELECT account_id, balance FROM credit_wallet ORDER BY balance DESC`,
  );
  return rows.map((r) => ({
    accountId: r.account_id,
    balance: Number(r.balance),
  }));
}

export async function readLicenses(tx: TenantExecutor): Promise<LicenseRow[]> {
  const { rows } = await tx.query<{
    account_id: string;
    major: number;
    tier: string;
    expiry: string | null;
    issued_at: string;
  }>(
    `SELECT account_id, major, tier, expiry, issued_at
       FROM license_grant
      ORDER BY issued_at DESC`,
  );
  return rows.map((r) => ({
    accountId: r.account_id,
    major: Number(r.major),
    tier: r.tier,
    expiry: r.expiry === null ? null : String(r.expiry),
    issuedAt: String(r.issued_at),
  }));
}

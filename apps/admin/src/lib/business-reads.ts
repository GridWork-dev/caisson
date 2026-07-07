// Cross-tenant business-admin readers (ADR-0141). Each runs inside `readAdmin` (the read-only `admin`
// role), so a query with NO `WHERE account_id = …` returns EVERY tenant's rows — the operator view,
// the exact inverse of the buyer surface's per-tenant `withTenant` reads. Raw SQL against the tables
// owned by @caisson/credits + @caisson/service-license (the same deliberately-flagged cross-service
// coupling apps/site carries): the schema DDL is imported into the double (admin-db.ts) so a column
// rename fails the build, not silently at runtime.
import {
  balance,
  creditsClawedForSource,
  creditsGrantedBySource,
} from "@caisson/credits";
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

// --- ADR-0225 paid-purchase revoke: the impact-preview read seam (Fork R-2/R-6) ----------------
//
// The v2 paid-revoke UI card MUST show the operator a concrete impact BEFORE arming the confirm
// (R-6 = A). This read powers both the source PICKER (the account's active one-time purchases — the
// only revocable sources, R-3 = A) and the per-source IMPACT: which entitlements DROP vs SURVIVE
// (the refcount rule `revokePurchaseGrants` preserves), and the credit CLAW preview — the EXACT
// arithmetic the mutation runs (`min(max(0, granted − alreadyClawed), balance)`), reusing the same
// `@caisson/credits` helpers so the preview can never drift from what the revoke actually claws.

/** One revocable one-time purchase's full impact (a picker row + its preview). */
export interface PurchaseSourcePreview {
  /** The PaymentIntent / Paddle transaction id — the R-2 revoke target. */
  purchaseId: string;
  grantedAt: string;
  /** Entitlements this purchase backs that will DROP (no sibling active grant refcounts them). */
  entitlementsDropping: string[];
  /** Entitlements this purchase backs that SURVIVE (another active source still backs them). */
  entitlementsSurviving: string[];
  /** Credits this purchase granted (positive ledger sum, keyed on the purchase id). */
  granted: number;
  /** Credits already clawed for this purchase (either delivery order, CAISSON-5 symmetric). */
  alreadyClawed: number;
  /** Credits an opt-in claw would ACTUALLY reclaim: `min(max(0, granted − alreadyClawed), balance)`. */
  clawPreview: number;
}

/** The account-scoped paid-revoke preview: the picker sources + the account-wide claw ceiling + the
 *  edge deny-set size (revoking a paid purchase denies EVERY held license — account-scoped, R-4). */
export interface AccountRevokePreview {
  accountId: string;
  /** The wallet balance — the claw's hard ceiling (a claw never pushes the wallet below zero). */
  balance: number;
  /** Every held license id `revokeEdgeAccess` would add to the edge deny-set (account-scoped). */
  licensesToDeny: string[];
  /** The account's active one-time purchases, newest grant first — the picker + per-source impact. */
  sources: PurchaseSourcePreview[];
}

/**
 * Compute the paid-purchase revoke preview for one account (ADR-0225 R-6). Runs inside `readAdmin`
 * (the read-only `admin` role): one read of every ACTIVE grant drives both the source list AND the
 * per-source refcount-survival split (computed in JS — no N+1 SQL), plus the reused credit helpers
 * for the exact claw the mutation would run and the held-license set the edge deny-set would carry.
 * Read-only — it never writes; the actual revoke is the GitHub-OAuth-gated mutation route (ADR-0283).
 */
export async function previewAccountPurchaseRevokes(
  tx: TenantExecutor,
  accountId: string,
): Promise<AccountRevokePreview> {
  const { rows: active } = await tx.query<{
    entitlement_id: string;
    source_kind: string;
    purchase_id: string | null;
    granted_at: string;
  }>(
    `SELECT entitlement_id, source_kind, purchase_id, granted_at
       FROM entitlement_grant
      WHERE account_id = $1 AND status = 'active'
      ORDER BY granted_at DESC`,
    [accountId],
  );

  const walletBalance = await balance(tx, accountId);

  const { rows: licenseRows } = await tx.query<{ license_id: string }>(
    `SELECT DISTINCT license_id FROM license_grant WHERE account_id = $1 ORDER BY license_id`,
    [accountId],
  );
  const licensesToDeny = licenseRows.map((r) => r.license_id);

  // Distinct one-time purchase ids (the R-3-revocable sources), preserving the newest-first order.
  const purchaseIds: string[] = [];
  const grantedAtByPurchase = new Map<string, string>();
  for (const row of active) {
    if (row.source_kind !== "one_time" || row.purchase_id === null) continue;
    if (!grantedAtByPurchase.has(row.purchase_id)) {
      purchaseIds.push(row.purchase_id);
      grantedAtByPurchase.set(row.purchase_id, String(row.granted_at));
    }
  }

  const sources: PurchaseSourcePreview[] = [];
  for (const purchaseId of purchaseIds) {
    const backed = [
      ...new Set(
        active
          .filter(
            (r) => r.source_kind === "one_time" && r.purchase_id === purchaseId,
          )
          .map((r) => r.entitlement_id),
      ),
    ].sort();
    const entitlementsDropping: string[] = [];
    const entitlementsSurviving: string[] = [];
    for (const entitlementId of backed) {
      // Survives iff SOME other active grant (any source except THIS purchase's one-time rows) still
      // backs it — the refcount survival `revokePurchaseGrants` guarantees. Drops otherwise.
      const survives = active.some(
        (r) =>
          r.entitlement_id === entitlementId &&
          !(r.source_kind === "one_time" && r.purchase_id === purchaseId),
      );
      if (survives) entitlementsSurviving.push(entitlementId);
      else entitlementsDropping.push(entitlementId);
    }
    const granted = await creditsGrantedBySource(tx, accountId, purchaseId);
    const alreadyClawed = await creditsClawedForSource(
      tx,
      accountId,
      purchaseId,
    );
    const clawPreview = Math.min(
      Math.max(0, granted - alreadyClawed),
      walletBalance,
    );
    sources.push({
      purchaseId,
      grantedAt: grantedAtByPurchase.get(purchaseId) ?? "",
      entitlementsDropping,
      entitlementsSurviving,
      granted,
      alreadyClawed,
      clawPreview,
    });
  }

  return { accountId, balance: walletBalance, licensesToDeny, sources };
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

// Cross-tenant business-admin readers (ADR-0141). Each runs inside `readAdmin` (the read-only `admin`
// role), so a query with NO `WHERE account_id = …` returns EVERY tenant's rows — the operator view,
// the exact inverse of the buyer surface's per-tenant `withTenant` reads. Raw SQL against the tables
// owned by @caisson/credits + @caisson/service-license (the same deliberately-flagged cross-service
// coupling apps/site carries): the schema DDL is imported into the double (admin-db.ts) so a column
// rename fails the build, not silently at runtime.
//
// F4 (ADR-0316): `readEntitlements`/`readLicenses` now source their SELECT column lists from
// `@caisson/platform-reads`' exported constants (and `readEntitlements` its row TYPE), so a
// `services/license` schema rename fails THIS build too — the same column-contract seam the buyer
// dashboard rides — while KEEPING admin's cross-tenant (no `account_id` predicate) SQL shape. The
// package's readers are single-account-scoped by design (`WHERE account_id = $1`), so admin can never
// call them directly, only reuse their column-list / type contract.
//
// The W-COMMERCE money-timeline reads below (`readAccountCreditTimeline` / `readAccountOrders` /
// `readAccountSubscriptions`) are scoped to ONE operator-picked account (`WHERE account_id = $1`).
// `credit_event` + `credit_wallet` already carry the `admin`-role read policy (ADR-0225). `order_record`
// + `subscription_status` (and `grant_consumption`, which `expiringSoon` joins) do NOT yet — they must
// be added to `ADMIN_READ_TABLES` in admin-db.ts (dev double) + provisioned via `buildAdminReadPolicySql`
// on the Railway PG at DEPLOY, or these reads return a permission error the ledger page degrades to a
// "not granted to the admin read role yet" hint rather than a 500.
import {
  balance,
  creditsClawedForSource,
  creditsGrantedBySource,
  getLedger,
  GRANT_EVENT_TYPES,
} from "@caisson/credits";
import {
  ENTITLEMENT_GRANT_READ_COLUMNS,
  type EntitlementGrantRow,
  type LICENSE_GRANT_READ_COLUMNS,
} from "@caisson/platform-reads";
import type { TenantExecutor } from "@caisson/tenancy-rls";

/** One tenant's business footprint — the operator's tenants overview. */
export interface TenantRow {
  accountId: string;
  /** The account's resolved notification address (better-auth "user" table, via account_member's
   *  owner-or-first-member — same resolution `@caisson/service-license`'s `findBuyerEmail` uses for
   *  a single account). `null` when no "user" row is resolvable (G29). */
  email: string | null;
  creditBalance: number;
  entitlementCount: number;
  licenseCount: number;
}

export interface ReadTenantsOptions {
  /** Case-insensitive substring match against the account id OR the resolved email (G29). */
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ReadTenantsResult {
  rows: TenantRow[];
  /** Total matching rows ignoring limit/offset — drives the pager. */
  total: number;
}

const TENANTS_DEFAULT_LIMIT = 50;
const TENANTS_MAX_LIMIT = 200;

/** Bound every OTHER business-table read too (G29: "no search/filter/pagination on any table" —
 *  these three have no dedicated search UI yet, but must stop being literally unbounded). */
const OTHER_READS_LIMIT = 200;

/** An entitlement/purchase grant (a `one_time` row IS a purchase; `subscription` is recurring),
 *  cross-tenant. Extends the shared per-tenant {@link EntitlementGrantRow} (F4) with `accountId` —
 *  the row TYPE comes from `@caisson/platform-reads` so a `services/license` rename of a projected
 *  field is a compile error here, not a silent runtime desync. */
export interface EntitlementRow extends EntitlementGrantRow {
  accountId: string;
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

/** admin's cross-tenant license read is a strict SUBSET of `@caisson/platform-reads`'
 *  `LICENSE_GRANT_READ_COLUMNS` (it omits `license_id`/`token` — the operator overview never renders
 *  them). `satisfies` pins every name to a real member of the shared constant, so a `services/license`
 *  rename fails THIS build too (F4) without widening the read to columns admin doesn't need. */
const LICENSE_READ_COLUMNS = [
  "account_id",
  "major",
  "tier",
  "expiry",
  "issued_at",
] as const satisfies readonly (typeof LICENSE_GRANT_READ_COLUMNS)[number][];

/**
 * The tenants overview: every account with any business state (credits ∪ entitlements ∪ licenses),
 * with its credit balance + active-entitlement + license counts, EMAIL-ENRICHED (G29 — the
 * "DEPLOY follow-up" that never shipped) via a LATERAL join to account_member (owner, else the
 * earliest member) → better-auth's own "user" table. Search (account id or email substring, ILIKE)
 * and LIMIT/OFFSET pagination replace the previous fully-unbounded read; `total` (a `count(*)
 * OVER()` window, avoiding a second round trip) drives the pager.
 */
export async function readTenants(
  tx: TenantExecutor,
  opts: ReadTenantsOptions = {},
): Promise<ReadTenantsResult> {
  const limit = Math.min(
    Math.max(Math.trunc(opts.limit ?? TENANTS_DEFAULT_LIMIT), 1),
    TENANTS_MAX_LIMIT,
  );
  const offset = Math.max(Math.trunc(opts.offset ?? 0), 0);
  const search = opts.search?.trim();
  const hasSearch = search !== undefined && search.length > 0;
  const { rows } = await tx.query<{
    account_id: string;
    email: string | null;
    credit_balance: number;
    entitlement_count: number;
    license_count: number;
    total: string;
  }>(
    `SELECT t.account_id,
            u.email,
            COALESCE(cw.balance, 0)          AS credit_balance,
            COALESCE(e.entitlement_count, 0) AS entitlement_count,
            COALESCE(l.license_count, 0)     AS license_count,
            count(*) OVER()::text            AS total
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
       LEFT JOIN LATERAL (
         SELECT user_id FROM account_member
          WHERE account_id = t.account_id
          ORDER BY (role = 'owner') DESC, created_at
          LIMIT 1
       ) am ON true
       LEFT JOIN "user" u ON u.id = am.user_id
      WHERE ${hasSearch ? "(t.account_id ILIKE $3 OR u.email ILIKE $3)" : "true"}
      ORDER BY t.account_id
      LIMIT $1 OFFSET $2`,
    hasSearch ? [limit, offset, `%${search}%`] : [limit, offset],
  );
  return {
    rows: rows.map((r) => ({
      accountId: r.account_id,
      email: r.email,
      creditBalance: Number(r.credit_balance),
      entitlementCount: Number(r.entitlement_count),
      licenseCount: Number(r.license_count),
    })),
    total: rows.length > 0 ? Number(rows[0]!.total) : 0,
  };
}

export async function readEntitlements(
  tx: TenantExecutor,
): Promise<EntitlementRow[]> {
  const { rows } = await tx.query<{
    account_id: string;
    entitlement_id: string;
    source_kind: EntitlementGrantRow["sourceKind"];
    status: EntitlementGrantRow["status"];
    granted_at: string;
  }>(
    // F4: the SELECT list is the shared `@caisson/platform-reads` constant (`account_id` first), so a
    // schema rename desyncs at BUILD time, not silently at runtime — admin's cross-tenant shape stays
    // (no `WHERE account_id`), only the column source-of-truth is shared.
    `SELECT ${ENTITLEMENT_GRANT_READ_COLUMNS.join(", ")}
       FROM entitlement_grant
      ORDER BY granted_at DESC
      LIMIT ${String(OTHER_READS_LIMIT)}`,
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
    `SELECT account_id, balance FROM credit_wallet ORDER BY balance DESC LIMIT ${String(OTHER_READS_LIMIT)}`,
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
    // F4: SELECT list pinned to the shared `@caisson/platform-reads` column constant (subset thereof).
    `SELECT ${LICENSE_READ_COLUMNS.join(", ")}
       FROM license_grant
      ORDER BY issued_at DESC
      LIMIT ${String(OTHER_READS_LIMIT)}`,
  );
  return rows.map((r) => ({
    accountId: r.account_id,
    major: Number(r.major),
    tier: r.tier,
    expiry: r.expiry === null ? null : String(r.expiry),
    issuedAt: String(r.issued_at),
  }));
}

// --- W-COMMERCE money timeline (ADR-0316): per-account credit ledger + Paddle order/subscription
// history, drilled into from the tenants overview. All three reads are scoped to ONE account
// (`WHERE account_id = $1`) — the operator picks it; they are NOT the unbounded cross-tenant reads
// above. --------------------------------------------------------------------------------------------

export type LedgerKind = "grant" | "consume" | "claw" | "expiry";

/**
 * Map a `credit_event.event_type` to the operator-timeline bucket: `GRANT_EVENT_TYPES` → grant, the
 * refund clawback (ADR-0113) → claw, the expiry-sweep residue burn (ADR-0252) → expiry, every spend
 * debit → consume. Pure — the row's signed `amount` carries the direction; this is just the label.
 */
export function classifyLedgerKind(eventType: string): LedgerKind {
  if ((GRANT_EVENT_TYPES as readonly string[]).includes(eventType))
    return "grant";
  if (eventType === "refund_clawback") return "claw";
  if (eventType === "expiry_debit") return "expiry";
  return "consume";
}

export interface CreditTimelineRow {
  createdAt: string;
  kind: LedgerKind;
  eventType: string;
  /** Signed integer credit units — positive for a grant, negative for consume/claw/expiry. */
  amount: number;
  sourceEventId: string | null;
  feature: string | null;
}

export interface AccountCreditTimeline {
  balance: number;
  rows: CreditTimelineRow[];
}

/**
 * The per-account credit money timeline (grant/consume/claw/expiry), newest first, plus the wallet
 * balance. Reuses `@caisson/credits`' `getLedger` + `balance` verbatim (the package owns the ledger
 * SQL — admin never hand-rolls it); both read through the `admin` role's existing `credit_event` /
 * `credit_wallet` policies (ADR-0225). `getLedger` returns oldest-first — reversed here for the
 * operator's newest-first view.
 */
export async function readAccountCreditTimeline(
  tx: TenantExecutor,
  accountId: string,
): Promise<AccountCreditTimeline> {
  // Sequential on the one tx connection (never Promise.all on a single client).
  const ledger = await getLedger(tx, accountId);
  const walletBalance = await balance(tx, accountId);
  const rows: CreditTimelineRow[] = ledger.map((e) => ({
    createdAt: e.created_at,
    kind: classifyLedgerKind(e.event_type),
    eventType: e.event_type,
    amount: e.amount,
    sourceEventId: e.source_event_id,
    feature: e.feature,
  }));
  rows.reverse();
  return { balance: walletBalance, rows };
}

/**
 * One Paddle order/invoice row for the money timeline — the buyer-facing history `services/license`
 * writes at webhook time (`order_record`, ADR-0293). `status = 'refunded'` is the refund flag (the
 * ADR-0302 coverage-horizon claw fires on the same event); a chargeback is NOT a row here — ADR-0294
 * makes it alert-only, surfaced in-page as a note, never a tracked state. `discountId` is the ADR-0315
 * affiliate-attribution column, shown as a plain column (the commission REPORT is a separate lane).
 */
export interface OrderTimelineRow {
  sourceEventId: string;
  kind: string;
  priceId: string | null;
  label: string;
  amount: number;
  currency: string;
  status: string;
  discountId: string | null;
  createdAt: string;
}

/**
 * One account's Paddle orders, newest first, LIMIT-bounded (never an unbounded export). Selects the
 * ADR-0315 `discount_id` column directly rather than through `@caisson/platform-reads`' base column
 * set (which deliberately omits it — a separate ALTER migration, outside the shared column contract),
 * so this stays admin-local raw SQL. Requires the `admin`-role read policy on `order_record` (see the
 * module header) — absent, it throws a permission error the ledger page degrades gracefully.
 */
export async function readAccountOrders(
  tx: TenantExecutor,
  accountId: string,
): Promise<OrderTimelineRow[]> {
  const { rows } = await tx.query<{
    source_event_id: string;
    kind: string;
    price_id: string | null;
    label: string;
    amount: number;
    currency: string;
    status: string;
    discount_id: string | null;
    created_at: unknown;
  }>(
    `SELECT source_event_id, kind, price_id, label, amount, currency, status, discount_id, created_at
       FROM order_record
      WHERE account_id = $1
      ORDER BY created_at DESC
      LIMIT ${String(OTHER_READS_LIMIT)}`,
    [accountId],
  );
  return rows.map((r) => ({
    sourceEventId: r.source_event_id,
    kind: r.kind,
    priceId: r.price_id,
    label: r.label,
    amount: Number(r.amount),
    currency: r.currency,
    status: r.status,
    discountId: r.discount_id,
    createdAt:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
  }));
}

export interface SubscriptionTimelineRow {
  subscriptionId: string;
  planTag: string;
  priceId: string;
  status: string;
  updatedAt: string;
}

/**
 * One account's subscription-lifecycle rows, newest-updated first, LIMIT-bounded (`subscription_status`,
 * ADR-0293) — `status` is `active`/`canceled`. Requires the `admin`-role read policy on
 * `subscription_status` (see the module header); absent, the ledger page degrades gracefully.
 */
export async function readAccountSubscriptions(
  tx: TenantExecutor,
  accountId: string,
): Promise<SubscriptionTimelineRow[]> {
  const { rows } = await tx.query<{
    subscription_id: string;
    plan_tag: string;
    price_id: string;
    status: string;
    updated_at: unknown;
  }>(
    `SELECT subscription_id, plan_tag, price_id, status, updated_at
       FROM subscription_status
      WHERE account_id = $1
      ORDER BY updated_at DESC
      LIMIT ${String(OTHER_READS_LIMIT)}`,
    [accountId],
  );
  return rows.map((r) => ({
    subscriptionId: r.subscription_id,
    planTag: r.plan_tag,
    priceId: r.price_id,
    status: r.status,
    updatedAt:
      r.updated_at instanceof Date
        ? r.updated_at.toISOString()
        : String(r.updated_at),
  }));
}

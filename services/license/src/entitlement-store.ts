// The reference-counted entitlement-GRANT store (ADR-0113, evolving ADR-0071/0009). Replaces the flat
// `account_entitlement` state table with a JUNCTION: one ROW per (account, entitlement, source) grant.
// An account HAS an entitlement iff it holds >=1 ACTIVE grant for it — so two sources granting the same
// edition (a subscription AND a one-time buy) survive the loss of either alone (refcount), and a
// soft-revoke of one source never strips an entitlement another source still backs. Grants are NEVER
// hard-deleted (audit trail): a revoke flips `status='revoked'` + stamps `revoked_at`.
//
// Each grant records its SOURCE: `source_kind` in {subscription, one_time}. A subscription grant carries
// `subscription_id` (purchase_id NULL); a one-time grant carries `purchase_id` — the PaymentIntent id —
// (subscription_id NULL). The single ACTIVE-refcount truth still stores PURCHASED IDS (editions/bundle/
// modules), never the expanded member-slug leaf set — the registry index expands at gate time
// (`expandEntitlements`, resolve-entitlements.ts), so a module added to an edition reaches existing
// buyers with no store rewrite.
//
// Tenant-owned + fail-closed RLS via @caisson/tenancy-rls (ADR-0005): every read/write/revoke runs
// inside `withTenant`, scoped to the buyer's account; the policy WITH CHECK rejects a cross-tenant
// write, and a read that forgets its WHERE still sees only the caller's rows.
import { randomUUID } from "node:crypto";
import { ConfigError } from "@caisson/kernel";
import type { TenantExecutor } from "@caisson/tenancy-rls";
import { buildTenantPolicySql } from "@caisson/tenancy-rls";

// One row per grant. The idempotency anchor is the expression-unique index
// `entitlement_grant_uniq (account_id, entitlement_id, source_kind, COALESCE(subscription_id,
// purchase_id))`: a subscription RENEWAL re-confirming the same edition for the same subscription, or a
// one-time webhook retry on the same payment, collapses to the existing row (ON CONFLICT DO NOTHING) —
// refcount stays one-per-source, so a later revoke of that source clears exactly its single grant. The
// CHECKs pin the source shape (a subscription grant has a subscription_id and no purchase_id, and vice
// versa) and the revoke biconditional (revoked iff revoked_at is set).
export const ENTITLEMENT_SCHEMA_SQL = `
CREATE TABLE entitlement_grant (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  entitlement_id text NOT NULL,
  source_kind text NOT NULL,
  subscription_id text,
  purchase_id text,
  source_event_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT entitlement_grant_source_kind CHECK (source_kind IN ('subscription', 'one_time', 'admin_comp')),
  CONSTRAINT entitlement_grant_status CHECK (status IN ('active', 'revoked')),
  CONSTRAINT entitlement_grant_source_ref CHECK (
    (source_kind = 'subscription' AND subscription_id IS NOT NULL AND purchase_id IS NULL)
    OR (source_kind = 'one_time' AND purchase_id IS NOT NULL AND subscription_id IS NULL)
    OR (source_kind = 'admin_comp' AND subscription_id IS NULL AND purchase_id IS NULL)
  ),
  CONSTRAINT entitlement_grant_revoked_iff CHECK (
    (status = 'revoked') = (revoked_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX entitlement_grant_uniq
  ON entitlement_grant (account_id, entitlement_id, source_kind, COALESCE(subscription_id, purchase_id));

${buildTenantPolicySql("entitlement_grant")}
`;

// ADR-0220 (Fork AM-3/AM-2). The forward migration for an environment that already created the
// junction under the pre-admin_comp CHECKs (ADR-0113): widen `source_kind` + `source_ref` to admit
// a third `admin_comp` source (an operator comp/revoke — no subscription_id, no purchase_id, so it
// NEVER reference-counts against a real purchase, ADR-0113 intact). The cross-tenant `admin_write`
// POLICY for this table is applied SEPARATELY via `ADMIN_MUTATION_PROVISION_SQL` (admin-mutations.ts)
// alongside the base credit tables' policies, so it lands once the `admin_write` role exists —
// never embedded in a schema constant every buyer-path test applies. Applied to the Railway PG at
// DEPLOY via the numbered-migrate path (ADR-0014); the unit-test DDL above already builds the CHECKs
// fresh, and the mutation-surface tests apply `ADMIN_MUTATION_PROVISION_SQL` for the policy.
export const ENTITLEMENT_ADMIN_COMP_MIGRATION_SQL = `
ALTER TABLE entitlement_grant DROP CONSTRAINT IF EXISTS entitlement_grant_source_kind;
ALTER TABLE entitlement_grant ADD CONSTRAINT entitlement_grant_source_kind
  CHECK (source_kind IN ('subscription', 'one_time', 'admin_comp'));
ALTER TABLE entitlement_grant DROP CONSTRAINT IF EXISTS entitlement_grant_source_ref;
ALTER TABLE entitlement_grant ADD CONSTRAINT entitlement_grant_source_ref CHECK (
  (source_kind = 'subscription' AND subscription_id IS NOT NULL AND purchase_id IS NULL)
  OR (source_kind = 'one_time' AND purchase_id IS NOT NULL AND subscription_id IS NULL)
  OR (source_kind = 'admin_comp' AND subscription_id IS NULL AND purchase_id IS NULL)
);
`;

// Forward migration from the prior flat `account_entitlement` shape (ADR-0071) → the junction
// (ADR-0113), for the prod numbered-Drizzle path (ADR-0014). PRE-LAUNCH there is no live data
// (checkout is not yet live, ADR-0082/0106), so the new schema supersedes the old cleanly; this snippet
// is the belt-and-suspenders backfill for any environment that DID create the old table. Each legacy
// row becomes an ACTIVE one_time grant keyed on its source event id (the safe default — legacy grants
// carry no subscription provenance, so they must NOT be swept by a subscription cancel). Idempotent +
// guarded by table existence; runs in PL/pgSQL (not exercised by the unit-test DDL, which builds the
// junction fresh).
export const ENTITLEMENT_GRANT_MIGRATION_SQL = `
DO $$
BEGIN
  IF to_regclass('account_entitlement') IS NOT NULL THEN
    INSERT INTO entitlement_grant
      (id, account_id, entitlement_id, source_kind, purchase_id, source_event_id, status, granted_at)
    SELECT id, account_id, entitlement_id, 'one_time',
           COALESCE(source_event_id, id), COALESCE(source_event_id, id), 'active', granted_at
    FROM account_entitlement
    ON CONFLICT DO NOTHING;
    DROP TABLE account_entitlement;
  END IF;
END $$;
`;

// Per-line refund support (ADR-0218, fork C-b: a column, not a side-table). Adds `line_item_id` (the
// Paddle `txnitm_…` that granted the row) and folds it into the uniqueness index via
// `COALESCE(line_item_id, '')` — so two lines of ONE cart granting the SAME edition become TWO grant
// rows (a true per-line refcount, fork B-1: the edition stays entitled until EVERY backing line is
// refunded) while a subscription/single-source grant (line_item_id NULL → '') keeps its prior
// uniqueness exactly. SEPARATE migration, not an edit to ENTITLEMENT_SCHEMA_SQL: that ships as the
// checksum-pinned `0003_entitlement_grant.sql` platform migration (ADR-0006 append-only) — editing it
// in place would fail the runner closed on the live DB. Apply AFTER ENTITLEMENT_SCHEMA_SQL everywhere
// the junction is bootstrapped. Pre-launch there is no live grant data (ADR-0113 §1), so the index
// swap is clean; this supersedes ADR-0113 §1's locked uniqueness index to incorporate the new column.
export const ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL = `
ALTER TABLE entitlement_grant ADD COLUMN line_item_id text;
DROP INDEX entitlement_grant_uniq;
CREATE UNIQUE INDEX entitlement_grant_uniq
  ON entitlement_grant (account_id, entitlement_id, source_kind, COALESCE(subscription_id, purchase_id), COALESCE(line_item_id, ''));
`;

// ADR-0244/0251 (Decision 5): the per-grant updates-window override. A renewal purchase extends the
// buyer's 12-month updates window by stamping `updates_expires_at` on the ACTIVE one_time grant rows
// for the renewed (account, entitlement) pair; the issuer reads it back at /issue
// (`computeUpdatesWindows`, ADR-0255 — GROUP BY entitlement_id). Additive + nullable — NULL means
// "no renewal yet", the issuer then derives the baseline `granted_at + 12 months`. SEPARATE
// migration, not an edit to ENTITLEMENT_SCHEMA_SQL,
// for the same checksum-pinning reason as the line_item migration above (ADR-0006 append-only): the
// prior files are frozen on the live DB. Ships as the numbered `0016_entitlement_updates_window.sql`
// platform migration (0014/0015 are reserved by the parallel credits build).
export const ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL = `
ALTER TABLE entitlement_grant ADD COLUMN updates_expires_at timestamptz;
`;

/** The provenance of a grant: a recurring subscription, or a one-time (non-subscription) purchase. */
export type GrantSource =
  | { kind: "subscription"; subscriptionId: string }
  | { kind: "one_time"; purchaseId: string };

export interface GrantEntitlementsInput {
  /** The buyer account — MUST equal the `withTenant` scope (the RLS WITH CHECK enforces it). */
  accountId: string;
  /** Purchased ids to grant (editions/bundle/modules). An empty array is a no-op. */
  entitlementIds: readonly string[];
  /** Provenance: the billing/purchase event id that granted these (audit). */
  sourceEventId: string;
  /** WHICH source backs this grant — the refcount key + the revoke filter. */
  source: GrantSource;
  /**
   * Paddle per-line join key (ADR-0218): the `txnitm_…` line that granted these ids. Set on a
   * one-time per-line grant so a later per-line adjustment refund revokes only THAT line's row
   * (fork B-1 refcount). Omitted for a subscription grant / a driver with no per-line data → NULL,
   * which the `COALESCE(line_item_id, '')` index treats as the pre-0218 single-slot uniqueness.
   */
  lineItemId?: string;
}

function sourceColumns(source: GrantSource): {
  kind: GrantSource["kind"];
  subscriptionId: string | null;
  purchaseId: string | null;
} {
  return source.kind === "subscription"
    ? {
        kind: "subscription",
        subscriptionId: source.subscriptionId,
        purchaseId: null,
      }
    : { kind: "one_time", subscriptionId: null, purchaseId: source.purchaseId };
}

/**
 * Grant a set of purchased-id entitlements to an account from one source, idempotently. Each id is
 * upserted ON CONFLICT DO NOTHING on the per-source uniqueness, so a webhook retry or a subscription
 * renewal re-granting the same edition from the same source is absorbed without a duplicate row and
 * without poisoning the surrounding transaction (a caught 23505 would). Must run inside
 * `withTenant(pg, accountId, …)`. Returns the number of grants NEWLY created (0 on a full replay).
 */
export async function grantEntitlements(
  tx: TenantExecutor,
  input: GrantEntitlementsInput,
): Promise<number> {
  const cols = sourceColumns(input.source);
  // NULL (not "") for the omitted-line-item case: the index's COALESCE(line_item_id, '') maps NULL to
  // the same single slot the pre-0218 uniqueness used, so subscription renewals + no-line drivers keep
  // collapsing to one row while distinct `txnitm_` ids give one row per cart line (fork B-1).
  const lineItemId = input.lineItemId ?? null;
  let granted = 0;
  for (const entitlementId of input.entitlementIds) {
    const inserted = await tx.query<{ id: string }>(
      `INSERT INTO entitlement_grant
         (id, account_id, entitlement_id, source_kind, subscription_id, purchase_id, source_event_id, line_item_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (account_id, entitlement_id, source_kind, COALESCE(subscription_id, purchase_id), COALESCE(line_item_id, ''))
       DO NOTHING
       RETURNING id`,
      [
        randomUUID(),
        input.accountId,
        entitlementId,
        cols.kind,
        cols.subscriptionId,
        cols.purchaseId,
        input.sourceEventId,
        lineItemId,
      ],
    );
    if (inserted.rows.length > 0) granted += 1;
  }
  return granted;
}

/**
 * Read an account's ACTIVE purchased-id entitlements (the raw ids, NOT expanded), distinct across
 * sources — an account holding the same edition from two sources still reads it once. A fully-revoked
 * entitlement (refcount 0) drops out. RLS scopes the result to the bound account; the explicit
 * `account_id` predicate is belt-and-suspenders over that gate. Sorted for a stable result. Run inside
 * `withTenant`.
 */
export async function readEntitlements(
  tx: TenantExecutor,
  accountId: string,
): Promise<string[]> {
  const r = await tx.query<{ entitlement_id: string }>(
    `SELECT DISTINCT entitlement_id FROM entitlement_grant
     WHERE account_id = $1 AND status = 'active'
     ORDER BY entitlement_id`,
    [accountId],
  );
  return r.rows.map((row) => row.entitlement_id);
}

export interface RevokeSubscriptionInput {
  accountId: string;
  subscriptionId: string;
}

/**
 * Soft-revoke (status='revoked' + revoked_at=now) every ACTIVE grant backed by a given subscription —
 * and ONLY that subscription (never another's, never a one-time grant). The entitlement is lost only
 * when its refcount hits 0, so an entitlement also backed by an active one-time grant survives. Already-
 * revoked grants are skipped (status='active' filter) → idempotent. Returns the number revoked. Run
 * inside `withTenant`.
 */
export async function revokeSubscriptionGrants(
  tx: TenantExecutor,
  input: RevokeSubscriptionInput,
): Promise<number> {
  const r = await tx.query<{ id: string }>(
    `UPDATE entitlement_grant
       SET status = 'revoked', revoked_at = now()
     WHERE account_id = $1
       AND source_kind = 'subscription'
       AND subscription_id = $2
       AND status = 'active'
     RETURNING id`,
    [input.accountId, input.subscriptionId],
  );
  return r.rows.length;
}

export interface RevokePurchaseInput {
  accountId: string;
  purchaseId: string;
}

/**
 * Soft-revoke every ACTIVE grant backed by a given one-time purchase (the PaymentIntent id) — the
 * refund path. Already-revoked grants are skipped → idempotent (a re-delivered refund revokes nothing
 * the second time, the latch the refund handler keys its clawback on). Returns the number revoked. Run
 * inside `withTenant`.
 */
export async function revokePurchaseGrants(
  tx: TenantExecutor,
  input: RevokePurchaseInput,
): Promise<number> {
  const r = await tx.query<{ id: string }>(
    `UPDATE entitlement_grant
       SET status = 'revoked', revoked_at = now()
     WHERE account_id = $1
       AND source_kind = 'one_time'
       AND purchase_id = $2
       AND status = 'active'
     RETURNING id`,
    [input.accountId, input.purchaseId],
  );
  return r.rows.length;
}

export interface RevokePurchaseLineInput {
  accountId: string;
  /** The one-time purchase id (the PaymentIntent / Paddle transaction id). */
  purchaseId: string;
  /** The Paddle `txnitm_…` line whose grant this refund revokes. */
  lineItemId: string;
}

/**
 * Soft-revoke every ACTIVE grant backed by ONE line of a one-time purchase — the per-line refund path
 * (ADR-0218, fork A-1 full-item / fork B-1 refcount). Revokes only the `(purchase_id, line_item_id)`
 * rows, so an entitlement ALSO granted by another still-active line of the same cart keeps its
 * refcount > 0 and stays in `readEntitlements` — the edition is lost only when EVERY backing line is
 * refunded. Already-revoked rows are skipped → idempotent across adjustment redeliveries. Returns the
 * number revoked. Run inside `withTenant`.
 */
export async function revokePurchaseLineGrants(
  tx: TenantExecutor,
  input: RevokePurchaseLineInput,
): Promise<number> {
  const r = await tx.query<{ id: string }>(
    `UPDATE entitlement_grant
       SET status = 'revoked', revoked_at = now()
     WHERE account_id = $1
       AND source_kind = 'one_time'
       AND purchase_id = $2
       AND line_item_id = $3
       AND status = 'active'
     RETURNING id`,
    [input.accountId, input.purchaseId, input.lineItemId],
  );
  return r.rows.length;
}

// --- Operator comp grants (ADR-0220) ----------------------------------------------------------
//
// The admin mutation surface's grant/revoke run as the cross-tenant `admin_write` role
// (`withAdminWrite`, @caisson/tenancy-rls), NOT `withTenant`/`app` — DB-level separation of
// operator-write from buyer-runtime (Fork AM-2 = B). Both filter by an explicit `account_id`, so a
// single call is bounded to exactly one target account (the RLS cross-tenant policy is `WITH CHECK
// (true)`; the bound is the caller passing one id). `source_kind = 'admin_comp'` keeps a comp
// distinct from every real purchase, so `revokePurchaseGrants` can never sweep it and it never
// reference-counts a real subscription/one-time buy (ADR-0113 refcount semantics intact).

export interface GrantAdminCompInput {
  /** The target account — the operator-chosen tenant (NOT a session, per the sanctioned exception). */
  accountId: string;
  /** Purchased ids to comp (editions/bundle/modules). An empty array is a no-op. */
  entitlementIds: readonly string[];
  /** The admin action's provenance id (a UUID minted per operator action) — audit trail. */
  sourceEventId: string;
}

/**
 * Comp a set of entitlements to an account as the operator (source_kind `admin_comp`). Each id is a
 * fresh grant row (both source ids NULL). Returns the number of grants created. Must run inside
 * `withAdminWrite(db, …)` (the cross-tenant operator-write role) — the writer filters on
 * `input.accountId`, so the write is bounded to that single account.
 *
 * // ponytail: a re-submitted comp for the same id makes a second `admin_comp` grant (the source_ref
 * // for admin_comp is NULL/NULL, so the per-source unique index does not dedupe it). Operator
 * // actions are deliberate, low-volume, and dual-logged, so this is benign; add a source_event_id
 * // unique index only if double-submit dedup is ever needed.
 */
export async function grantAdminComp(
  tx: TenantExecutor,
  input: GrantAdminCompInput,
): Promise<number> {
  let granted = 0;
  for (const entitlementId of input.entitlementIds) {
    const inserted = await tx.query<{ id: string }>(
      `INSERT INTO entitlement_grant
         (id, account_id, entitlement_id, source_kind, subscription_id, purchase_id, source_event_id)
       VALUES ($1, $2, $3, 'admin_comp', NULL, NULL, $4)
       RETURNING id`,
      [randomUUID(), input.accountId, entitlementId, input.sourceEventId],
    );
    if (inserted.rows.length > 0) granted += 1;
  }
  return granted;
}

export interface RevokeAdminCompInput {
  accountId: string;
  entitlementId: string;
}

/**
 * Soft-revoke (status='revoked' + revoked_at) an account's ACTIVE `admin_comp` grants for one
 * entitlement — undoing an operator comp. Only touches `admin_comp` rows: a real subscription/
 * one-time grant backing the same entitlement is never swept by the operator surface (refcount
 * against real purchases is preserved; revoking a paid entitlement stays the webhook path).
 * Idempotent (already-revoked rows are skipped). Returns the number revoked. Run inside
 * `withAdminWrite`.
 *
 * // ponytail: v1 operator revoke is comp-only. Revoking a real purchase/subscription entitlement
 * // is a deliberate follow-up (it must decide the refund/refcount interaction) — out of scope here.
 */
export async function revokeAdminComp(
  tx: TenantExecutor,
  input: RevokeAdminCompInput,
): Promise<number> {
  const r = await tx.query<{ id: string }>(
    `UPDATE entitlement_grant
       SET status = 'revoked', revoked_at = now()
     WHERE account_id = $1
       AND entitlement_id = $2
       AND source_kind = 'admin_comp'
       AND status = 'active'
     RETURNING id`,
    [input.accountId, input.entitlementId],
  );
  return r.rows.length;
}

// --- ADR-0244/0255 updates windows --------------------------------------------------------------

/**
 * Compute the account's PER-ENTITLEMENT updates-window bounds for the signed `updatesWindows`
 * claim (ADR-0255 Decision 2), from DB truth over the ACTIVE one_time grants: per
 * `(account, entitlement)` pair, each row's bound is `updates_expires_at` where a renewal set it,
 * else `granted_at + 12 months`, and the pair takes its MOST FAVORABLE (max) row — so a duplicate
 * re-purchase starts a fresh 12 months rather than inheriting the oldest purchase's window, the
 * per-pair mirror of ADR-0255 Decision 3's most-favorable-window rule. Returns a
 * `purchasedEntitlementId → ISO instant` map; EMPTY when the account holds no active one-time
 * grants — an unbounded claim (subscription-only accounts keep their existing expiry semantics,
 * ADR-0244 §4; subscription-sourced entitlements never get a key). Deterministic for a fixed
 * grant set (no `now()`), so the /issue re-mint comparison is stable. Run inside `withTenant`.
 */
export async function computeUpdatesWindows(
  tx: TenantExecutor,
  accountId: string,
): Promise<Record<string, string>> {
  const r = await tx.query<{
    entitlement_id: string;
    bound: string | Date;
  }>(
    `SELECT entitlement_id,
            max(COALESCE(updates_expires_at, granted_at + interval '12 months')) AS bound
       FROM entitlement_grant
      WHERE account_id = $1 AND source_kind = 'one_time' AND status = 'active'
      GROUP BY entitlement_id`,
    [accountId],
  );
  const windows: Record<string, string> = {};
  for (const row of r.rows) {
    windows[row.entitlement_id] = new Date(row.bound).toISOString();
  }
  return windows;
}

export interface ExtendUpdatesWindowInput {
  /** The buyer account — MUST equal the `withTenant` scope (the RLS WITH CHECK enforces it). */
  accountId: string;
  /** The renewed purchased id (RENEWAL_BOOK `renewsEntitlement`). */
  entitlementId: string;
  /** The renewal purchase's billing event id — audit context for the fail-closed throw. */
  sourceEventId: string;
}

/**
 * Extend the updates window for one `(account, entitlement)` pair by 12 months (ADR-0251
 * Decision 5, formula erratum corrected 2026-07-06): `updates_expires_at = GREATEST(now(),
 * COALESCE(updates_expires_at, granted_at + interval '12 months')) + 12 months` on every ACTIVE
 * one_time grant row for the pair (normally exactly one; a duplicate-purchase pair extends both
 * uniformly — never under-grants). The fallback is the base window END (`granted_at + 12mo`), not
 * `granted_at` — a first renewal bought mid-window stacks onto the remaining months instead of
 * silently dropping them; a renewal on a LAPSED window extends from now (never resurrects time
 * already elapsed past the lapse). FAIL-CLOSED on zero rows updated: renewing an entitlement the
 * account does not actively hold throws — a renewal never silently mints a grant. Idempotency
 * across webhook redeliveries is the caller's OUTER `sourceEventId` claim (webhook.ts), not
 * re-keyed here. Returns the number of rows extended. Run inside `withTenant`.
 */
export async function extendUpdatesWindow(
  tx: TenantExecutor,
  input: ExtendUpdatesWindowInput,
): Promise<number> {
  const r = await tx.query<{ id: string }>(
    `UPDATE entitlement_grant
       SET updates_expires_at =
             GREATEST(now(), COALESCE(updates_expires_at, granted_at + interval '12 months'))
             + interval '12 months'
     WHERE account_id = $1
       AND entitlement_id = $2
       AND source_kind = 'one_time'
       AND status = 'active'
     RETURNING id`,
    [input.accountId, input.entitlementId],
  );
  if (r.rows.length === 0) {
    throw new ConfigError(
      `renewal ${input.sourceEventId} extends no active one_time grant for entitlement ${input.entitlementId}`,
    );
  }
  return r.rows.length;
}

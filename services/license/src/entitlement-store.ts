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
// (`expandEntitlements`), so a module added to an edition reaches existing
// buyers with no store rewrite.
//
// Tenant-owned + fail-closed RLS via @caisson/tenancy-rls (ADR-0005): every read/write/revoke runs
// inside `withTenant`, scoped to the buyer's account; the policy WITH CHECK rejects a cross-tenant
// write, and a read that forgets its WHERE still sees only the caller's rows.
import { randomUUID } from "node:crypto";
import { withAdvisoryXactLock } from "@caisson/jobs";
import { ConfigError } from "@caisson/kernel";
import { UPDATES_WINDOWS_READ_SQL } from "@caisson/platform-reads";
import { entitlementIdAliasGroup } from "@caisson/registry-schema";
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

// ADR-0251 (Consequences — "refund of a renewal (un-extend) has no handler"): the renewal-EXTENSION
// ledger. A renewal SKU grants no entitlement + no credits (so there is no grant row / credit row to
// find on refund) — it only bumps `updates_expires_at` on the RENEWED pair's active one_time grant.
// A refund event carries the line's `txnitm_` id but NOT its price id, so without a record there is
// no way to know a refunded line was a renewal, nor to reverse exactly it. This table records ONE row
// per renewal line at purchase time — keyed to the renewal purchase's transaction id + the line's
// `txnitm_` — so `refund.completed` can find it and un-extend the window idempotently (the row
// LATCHES `active → reversed`, so a redelivered or sibling refund event never double-shrinks). SEPARATE
// migration (never an edit to a frozen constant, ADR-0006 append-only); ships as the numbered
// `0017_renewal_extension.sql` platform migration (0016 is the updates-window column). Tenant-owned +
// fail-closed RLS like every other table here. Pre-launch there is no live renewal data, so the table
// is created empty.
export const RENEWAL_EXTENSION_SCHEMA_SQL = `
CREATE TABLE renewal_extension (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  entitlement_id text NOT NULL,
  purchase_id text NOT NULL,
  line_item_id text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  extended_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz,
  CONSTRAINT renewal_extension_status CHECK (status IN ('active', 'reversed')),
  CONSTRAINT renewal_extension_reversed_iff CHECK (
    (status = 'reversed') = (reversed_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX renewal_extension_uniq
  ON renewal_extension (account_id, entitlement_id, purchase_id, line_item_id);

${buildTenantPolicySql("renewal_extension")}
`;

// CAISSON-128: persist the exact renewal tenor that moved the updates window so a later refund can
// subtract the same interval. SEPARATE migration, never an edit to the checksum-pinned
// `0017_renewal_extension.sql` above (ADR-0006 append-only). Nullable by design: rows written before
// this migration carry NULL and reverse as the historical one-year / 12-month tenor.
export const RENEWAL_EXTENSION_MONTHS_MIGRATION_SQL = `
ALTER TABLE renewal_extension ADD COLUMN months integer;
`;

// ADR-0381 lock 2: record what the buyer ACTUALLY paid for this grant, so a later upgrade quote can
// honour "a credit never falls below the buyer's own paid price" (`resolveUpgradeCredit`). The number
// is available on every Paddle line at grant time (`lineItems[].chargedAmount`) and was simply never
// persisted: `order_record.amount` is the whole TRANSACTION's grand total, which cannot be split
// across a multi-line cart after the fact. Storing it at grant time is what makes the clause
// enforceable offline, with no vendor read in the upgrade path.
//
// Minor units, matching the provider and `order_record.amount` — never dollars, never a float
// (ADR-0007). NULLABLE and left NULL whenever the charge cannot be attributed to exactly one SKU:
// an `admin_comp` grant, a driver with no per-line data (Stripe sends 0), a line whose price grants
// several entitlements, or quantity > 1. NULL means "unknown", and the quote falls back to retail —
// the honest answer, where a guessed split would silently over-credit every member of a bundle line
// with the whole bundle's price. SEPARATE migration, never an edit to a frozen constant (ADR-0006
// append-only); ships as `0031_entitlement_grant_charged_amount.sql`, a tail append after the
// site-local 0027-0029 and the shared 0030.
export const ENTITLEMENT_GRANT_CHARGED_AMOUNT_MIGRATION_SQL = `
ALTER TABLE entitlement_grant ADD COLUMN charged_amount integer;
ALTER TABLE entitlement_grant ADD COLUMN charged_currency text;
ALTER TABLE entitlement_grant ADD CONSTRAINT entitlement_grant_charged_amount_nonneg
  CHECK (charged_amount IS NULL OR charged_amount >= 0);
ALTER TABLE entitlement_grant ADD CONSTRAINT entitlement_grant_charged_pair
  CHECK ((charged_amount IS NULL) = (charged_currency IS NULL));
`;

// ADR-0394 (release-audit F2): `charged_amount` above is stamped once and NEVER mutates, so a later
// partial refund used to leave the upgrade-credit floor sitting at a price the buyer no longer paid.
// The refunded total lands HERE instead, and the quote nets the two at read time (`netCharged`).
//
// `refunded_adjustment_ids` is the idempotency anchor, and it is the reason this is two columns
// rather than one. This service has no event-level dedupe by design (`app.ts` — "Paddle retry of the
// same event_id re-applies as a no-op"), so every handler carries its own; an accumulating
// `refunded_amount = refunded_amount + $n` redelivers exactly as badly as the in-place decrement
// that was tried and reverted. The credit claw borrows its anchor from the `${adjustmentId}:${itemId}`
// unique key on its ledger row, which is unavailable here: that row is not written at all when the
// line granted zero credits — precisely the rows an upgrade quote reads.
//
// Tail append at the next free prefix; every slot at or below 0032 is checksum-pinned on the live DB
// (ADR-0006). Ships as `0033_entitlement_grant_refunded_amount.sql`.
export const ENTITLEMENT_GRANT_REFUNDED_AMOUNT_MIGRATION_SQL = `
ALTER TABLE entitlement_grant ADD COLUMN refunded_amount integer;
ALTER TABLE entitlement_grant ADD COLUMN refunded_adjustment_ids text[];
ALTER TABLE entitlement_grant ADD CONSTRAINT entitlement_grant_refunded_amount_nonneg
  CHECK (refunded_amount IS NULL OR refunded_amount >= 0);
`;

/**
 * What the buyer effectively paid for a grant after refunds, in minor units — `charged − refunded`,
 * floored at 0.
 *
 * NULL in, NULL out, deliberately: a NULL `charged_amount` means "this charge could not be
 * attributed to exactly one SKU", and the quote reads that as unknown and credits at retail. Folding
 * it to 0 here would silently turn "unknown" into "paid nothing" — a different and wrong answer.
 * This is the ONLY supported way to turn the two columns into a paid amount; read them raw and the
 * refund is what you forget.
 */
export { netCharged } from "@caisson/platform-reads";

export interface RecordLineRefundInput {
  /** The buyer account — MUST equal the `withTenant` scope. */
  accountId: string;
  /** The Paddle per-line join key (`txnitm_…`) whose grants this adjustment refunded. */
  lineItemId: string;
  /** THIS adjustment's refunded minor units for THIS line — a line total, never a cumulative one. */
  amountMinorUnits: number;
  /** The adjustment id; the applied-set member that makes a redelivery inert. */
  adjustmentId: string;
}

/**
 * Add one adjustment's refunded minor units to EVERY grant on `lineItemId`, idempotently.
 * Must run inside `withTenant(pg, accountId, …)`. Returns the number of grant rows updated — 0 on a
 * redelivery of the same adjustment, and 0 when the line has no grants (a credits-only line).
 *
 * Deliberately not filtered to `status = 'active'`: an out-of-order partial-after-full lands its
 * record on an already-revoked row, which is dead state rather than a defect (a revoked grant is
 * never owned, so it cannot reach `paidByItem`) and is worth keeping for audit.
 *
 * The guard and the write are ONE statement on purpose: split into a read-then-write they would
 * interleave, and two concurrent deliveries of the same adjustment would both observe an empty set
 * and both add. `array_append` on the matched rows is what makes the second delivery match nothing.
 */
export async function recordLineRefund(
  tx: TenantExecutor,
  input: RecordLineRefundInput,
): Promise<number> {
  if (input.amountMinorUnits <= 0) return 0;
  const updated = await tx.query<{ id: string }>(
    `UPDATE entitlement_grant
        SET refunded_amount = COALESCE(refunded_amount, 0) + $3,
            refunded_adjustment_ids =
              array_append(COALESCE(refunded_adjustment_ids, '{}'), $4)
      WHERE account_id = $1
        AND line_item_id = $2
        AND NOT (COALESCE(refunded_adjustment_ids, '{}') @> ARRAY[$4::text])
      RETURNING id`,
    [
      input.accountId,
      input.lineItemId,
      input.amountMinorUnits,
      input.adjustmentId,
    ],
  );
  return updated.rows.length;
}

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
  /**
   * What the buyer paid for THIS grant, in minor units, with its currency (ADR-0381 lock 2 — the
   * upgrade-credit floor). Set both or neither; the DB CHECK enforces the pair. Omit whenever the
   * charge cannot be attributed to exactly one SKU — the caller's job, not this function's, because
   * only the caller knows how many entitlements the line bought. An omitted amount records NULL,
   * which the upgrade quote reads as "unknown" and credits at retail.
   */
  charged?: { amountMinorUnits: number; currency: string };
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
  // Both-or-neither, matching the `entitlement_grant_charged_pair` CHECK (ADR-0381 lock 2).
  const chargedAmount = input.charged?.amountMinorUnits ?? null;
  const chargedCurrency = input.charged?.currency ?? null;
  let granted = 0;
  for (const entitlementId of input.entitlementIds) {
    const inserted = await tx.query<{ id: string }>(
      `INSERT INTO entitlement_grant
         (id, account_id, entitlement_id, source_kind, subscription_id, purchase_id, source_event_id, line_item_id, charged_amount, charged_currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
        chargedAmount,
        chargedCurrency,
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

/**
 * Read an account's ACTIVE `one_time`-backed purchased ids — the "entitlements the buyer ALREADY
 * OWNS" read (ADR-0269 Decision 1): the set a `coversOwnedEntitlements` plan re-grants
 * subscription-sourced on each granting invoice. Deliberately narrower than {@link readEntitlements}:
 * ids held only via another subscription (borrowed, not bought) or an `admin_comp` row are NOT
 * owned and never enter the re-grant. Distinct + sorted for a stable result. Run inside `withTenant`.
 */
export async function readOneTimeEntitlements(
  tx: TenantExecutor,
  accountId: string,
): Promise<string[]> {
  const r = await tx.query<{ entitlement_id: string }>(
    `SELECT DISTINCT entitlement_id FROM entitlement_grant
     WHERE account_id = $1 AND source_kind = 'one_time' AND status = 'active'
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

/** Count the purchase's remaining ACTIVE one-time grants — the per-line refund branch flips the
 *  purchase's `order_record` to 'refunded' when its revokes leave this at zero (SHIP-audit: Paddle
 *  types a line-by-line full refund as 'partial', so without the flip the affiliate report keeps
 *  paying full commission on a fully refunded order). Run inside the same tx as the revokes. */
export async function countActivePurchaseGrants(
  tx: TenantExecutor,
  accountId: string,
  purchaseId: string,
): Promise<number> {
  const r = await tx.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM entitlement_grant
     WHERE account_id = $1
       AND source_kind = 'one_time'
       AND purchase_id = $2
       AND status = 'active'`,
    [accountId, purchaseId],
  );
  return Number(r.rows[0]?.n ?? "0");
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
// (`withAdminWrite`, @caisson/org-controls), NOT `withTenant`/`app` — DB-level separation of
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

// --- ADR-0244/0255 updates windows + ADR-0269 subscription coverage ------------------------------

/**
 * The `line_item_id` sentinel marking an ADR-0269 COVERAGE MIRROR row — a subscription-sourced
 * re-grant of an entitlement the buyer already owns one_time (`coversOwnedEntitlements`). Real
 * Paddle line ids are `txnitm_…`, so the sentinel can never collide with a per-line grant, and it
 * keys mirrors SEPARATELY from a plan's static grant of the same id in the uniqueness index — the
 * refund reconcile ({@link reconcileCoverageGrants}) sweeps ONLY rows carrying this marker, never
 * a static subscription grant the buyer is still paying for.
 */
export const COVERAGE_MIRROR_LINE_ITEM = "covered";

export interface UpsertSubscriptionGrantsInput {
  /** The buyer account — MUST equal the transaction's scope. */
  accountId: string;
  /** Purchased ids to grant (static plan entitlements or ADR-0269 coverage mirrors). */
  entitlementIds: readonly string[];
  /** The subscription backing these grants — the revoke key for `subscription.canceled`. */
  subscriptionId: string;
  /** The granting invoice id (audit). */
  sourceEventId: string;
  /** The plan's billing cadence — sets the coverage horizon to `now() + one cadence`. */
  cadence: "month" | "year";
  /** True → mark the rows as ADR-0269 coverage mirrors (see {@link COVERAGE_MIRROR_LINE_ITEM}). */
  coverageMirror?: boolean;
}

/**
 * Grant/extend subscription-sourced entitlements with a COVERAGE HORIZON (ADR-0269, hardened
 * 2026-07-06 post-audit): each row is stamped `updates_expires_at = now() + one cadence` — the
 * instant this invoice's payment covers through — and each subsequent granting invoice EXTENDS the
 * horizon (GREATEST, monotone) on the still-active row. The horizon is what bounds every claim the
 * issuer signs for a covered pair (see {@link computeUpdatesWindows}): a canceled, paused, or
 * dunning-stalled subscription simply stops extending, so stale offline-verified tokens and
 * out-of-order webhook grants are all bounded by the LAST PAID period — never unbounded (audit
 * P1s 1–2, P2 3, P3 4, 2026-07-06). A REVOKED row on the key (a prior cancel or refund reconcile)
 * is never resurrected: the conflict lands, the `WHERE status='active'` guard skips the update, and
 * no new active row appears — the same tombstone semantics the static plans always had. Returns the
 * number of rows newly inserted or horizon-extended. Run inside `withTenant`.
 */
export async function upsertSubscriptionGrants(
  tx: TenantExecutor,
  input: UpsertSubscriptionGrantsInput,
): Promise<number> {
  const interval = input.cadence === "year" ? "1 year" : "1 month";
  const lineItemId = input.coverageMirror ? COVERAGE_MIRROR_LINE_ITEM : null;
  let touched = 0;
  for (const entitlementId of input.entitlementIds) {
    const r = await tx.query<{ id: string }>(
      `INSERT INTO entitlement_grant
         (id, account_id, entitlement_id, source_kind, subscription_id, purchase_id,
          source_event_id, line_item_id, updates_expires_at)
       VALUES ($1, $2, $3, 'subscription', $4, NULL, $5, $6, now() + $7::interval)
       ON CONFLICT (account_id, entitlement_id, source_kind, COALESCE(subscription_id, purchase_id), COALESCE(line_item_id, ''))
       DO UPDATE SET updates_expires_at = GREATEST(
           COALESCE(entitlement_grant.updates_expires_at, excluded.updates_expires_at),
           excluded.updates_expires_at)
         WHERE entitlement_grant.status = 'active'
       RETURNING id`,
      [
        randomUUID(),
        input.accountId,
        entitlementId,
        input.subscriptionId,
        input.sourceEventId,
        lineItemId,
        interval,
      ],
    );
    if (r.rows.length > 0) touched += 1;
  }
  return touched;
}

/**
 * ADR-0269 coverage-mirror lock key — shared by {@link grantOwnedCoverageMirrors}
 * (Decision 1's re-grant, called from `invoice.paid`) and {@link reconcileCoverageGrants} (the
 * refund sweep, called from `refund.completed` and the admin `purchase_revoke` action). Both do a
 * read-then-write over the SAME "which ids does this account own one_time" truth: without a shared
 * lock, a re-grant that reads "owned" ids concurrently with a refund's reconcile for the SAME
 * account could read BEFORE the refund's revoke commits, then write a FRESH coverage mirror for an
 * id whose one_time backing is (by the time the mirror lands) already gone — the refund's own
 * reconcile already ran once and nothing else ever sweeps that mirror again, so it leaks
 * subscription-sourced access to a refunded purchase for the life of the subscription (the
 * "wrong static-grant ordering" race). One advisory lock per account serializes every
 * coverage-mirror read-then-write for that account, mirroring `outstandingClaw`'s credits-side
 * guard (the same read-then-write class, same `withAdvisoryXactLock` primitive).
 */
function coverageLockKey(accountId: string): string {
  return `entitlement:coverage:${accountId}`;
}

/**
 * Acquire the account-scoped billing lock — the CANONICAL OUTERMOST lock of every transaction
 * that mutates an account's billing state (grants, mirrors, claws, revokes). Keyed identically to
 * {@link coverageLockKey}, so {@link reconcileCoverageGrants} / {@link grantOwnedCoverageMirrors}
 * re-acquire it re-entrantly (pg advisory xact locks stack within one session).
 *
 * WHY (security-audit finding, 2026-07-07): the coverage lock and the credits claw lock were
 * acquired in OPPOSITE orders across the whole-transaction refund / per-line adjustment / admin
 * revoke paths — a classic ABBA inversion that deadlocks (40P01) under exactly the concurrent
 * deliveries those locks exist to serialize. The rule that closes the whole class: every such
 * transaction takes THIS lock first, before any claw lock, entitlement row lock, or wallet row
 * lock. Two account-overlapping transactions then serialize entirely at entry, so no inner
 * acquisition order can invert. Paths that touch rows/wallet WITHOUT this lock (spend, plain
 * one-time grant fulfillment) cannot complete a cycle — they never wait on an advisory lock.
 *
 * The lock releases at transaction end (never manually). Callers: apply-billing-event
 * (invoice.paid, subscription.canceled, refund.completed both branches) and revokePurchaseAdmin.
 */
export async function acquireAccountBillingLock(
  tx: TenantExecutor,
  accountId: string,
): Promise<void> {
  await withAdvisoryXactLock(tx, coverageLockKey(accountId), async () => {});
}

/**
 * Revoke every ACTIVE coverage-MIRROR row whose one_time backing is gone (ADR-0269 refund
 * reconcile — audit P1 1, 2026-07-06): a refunded/admin-revoked purchase must not survive through
 * its subscription-sourced mirror. Scoped to rows carrying {@link COVERAGE_MIRROR_LINE_ITEM} —
 * a plan's STATIC grant of the same id (paid for by the subscription itself) is never swept. The
 * backing check is alias-group-tolerant: a mirror stored under a legacy spelling survives while any
 * spelling of its group still has an active one_time grant. Idempotent (active-only filter).
 * Runs under the {@link coverageLockKey} advisory lock shared with
 * {@link grantOwnedCoverageMirrors}, so this sweep and a concurrent re-grant for the same account
 * can never interleave out of order. Returns the number revoked. Run after every one_time revoke
 * path, in the same transaction.
 */
export async function reconcileCoverageGrants(
  tx: TenantExecutor,
  accountId: string,
): Promise<number> {
  return withAdvisoryXactLock(tx, coverageLockKey(accountId), async () => {
    const owned = await readOneTimeEntitlements(tx, accountId);
    const backed = [
      ...new Set(owned.flatMap((id) => entitlementIdAliasGroup(id))),
    ];
    const r = await tx.query<{ id: string }>(
      `UPDATE entitlement_grant
         SET status = 'revoked', revoked_at = now()
       WHERE account_id = $1
         AND source_kind = 'subscription'
         AND line_item_id = $2
         AND status = 'active'
         AND NOT (entitlement_id = ANY($3::text[]))
       RETURNING id`,
      [accountId, COVERAGE_MIRROR_LINE_ITEM, backed],
    );
    return r.rows.length;
  });
}

export interface GrantOwnedCoverageMirrorsInput {
  /** The buyer account — MUST equal the transaction's scope. */
  accountId: string;
  /** The `coversOwnedEntitlements` subscription granting this cycle's mirrors. */
  subscriptionId: string;
  /** The granting invoice id (audit + `upsertSubscriptionGrants` idempotency anchor). */
  sourceEventId: string;
  /** The plan's billing cadence — sets the coverage horizon to `now() + one cadence`. */
  cadence: "month" | "year";
}

/**
 * ADR-0269 Decision 1 — the Developer-plan re-grant: mirror, subscription-sourced, every
 * entitlement the buyer ALREADY OWNS via an active one_time grant. Runs under the SAME
 * {@link coverageLockKey} advisory lock {@link reconcileCoverageGrants} uses, so the
 * "owned ids" read here can never interleave with a concurrent refund's reconcile sweep for this
 * account — whichever operation's transaction commits first is fully visible to the second by the
 * time it re-reads ownership under the lock. Returns the covered ids (`[]` on a no-op), for the
 * caller's Discord/PostHog push. Run inside `withTenant`.
 */
export async function grantOwnedCoverageMirrors(
  tx: TenantExecutor,
  input: GrantOwnedCoverageMirrorsInput,
): Promise<string[]> {
  return withAdvisoryXactLock(
    tx,
    coverageLockKey(input.accountId),
    async () => {
      const coveredIds = await readOneTimeEntitlements(tx, input.accountId);
      if (coveredIds.length > 0) {
        await upsertSubscriptionGrants(tx, {
          accountId: input.accountId,
          entitlementIds: coveredIds,
          subscriptionId: input.subscriptionId,
          sourceEventId: input.sourceEventId,
          cadence: input.cadence,
          coverageMirror: true,
        });
      }
      return coveredIds;
    },
  );
}

export interface RollbackSubscriptionCoverageHorizonInput {
  /** The buyer account — MUST equal the `withTenant` scope. */
  accountId: string;
  /** The subscription whose refunded payment's coverage is being clawed — never another's rows. */
  subscriptionId: string;
  /** The refunded plan's billing cadence — one paid period is what the refund claws back. */
  cadence: "month" | "year";
}

/**
 * Claw back ONE paid period of coverage horizon after a SUBSCRIPTION-payment refund: every grant
 * row this subscription stamped a horizon on (static plan grants AND coverage mirrors) shrinks
 * `updates_expires_at` by one cadence interval. The horizon is a PAID fact — grandfathered across
 * cancel precisely because the payment was real — so un-paying it (a refund) is the one event
 * that legitimately shrinks it; leaving it live would leak a refunded period of updates/member
 * coverage into perpetual offline tokens forever. Deliberately NO status filter: a revoked row's
 * horizon still feeds the claim fold (the grandfathering read has no status filter either), so
 * the claw must reach revoked rows too. Horizons are fungible periods on one axis, so subtracting
 * one cadence is correct whichever cycle's payment was refunded. Idempotency is the CALLER's
 * order-record latch (the paid→refunded flip) — this UPDATE itself is not re-run-safe. Run inside
 * `withTenant`.
 *
 * // ponytail: a fixed one-cadence shrink (the renewal-reversal convention) rather than a stored
 * // pre-value: webhook-delivery jitter between granting invoices can leave the rolled-back bound
 * // off by that jitter, always favoring the buyer. Store per-invoice horizon deltas only if
 * // refund-exactness across jittered cycles ever matters.
 */
export async function rollbackSubscriptionCoverageHorizon(
  tx: TenantExecutor,
  input: RollbackSubscriptionCoverageHorizonInput,
): Promise<number> {
  const interval = input.cadence === "year" ? "1 year" : "1 month";
  const r = await tx.query<{ id: string }>(
    `UPDATE entitlement_grant
        SET updates_expires_at = updates_expires_at - $3::interval
      WHERE account_id = $1
        AND source_kind = 'subscription'
        AND subscription_id = $2
        AND updates_expires_at IS NOT NULL
      RETURNING id`,
    [input.accountId, input.subscriptionId, interval],
  );
  return r.rows.length;
}

/**
 * The account's per-spelling COVERAGE HORIZONS (ADR-0269, hardened 2026-07-06): for every purchased
 * id backed by a subscription grant that carries a horizon (`updates_expires_at` — stamped by
 * {@link upsertSubscriptionGrants} at each granting invoice), the MAX horizon, expanded to the
 * id's full alias group (the `extendUpdatesWindow` W7 convention). The claim computations below
 * fold this into a covered pair's bound instead of DROPPING the key — the original ADR-0269 drop
 * made a covered pair UNBOUNDED in a perpetual offline-verified token, which no cancel could ever
 * claw back (audit P1 2).
 *
 * Deliberately NO status filter (operator-locked 2026-07-06 picker — covered-period
 * grandfathering): a horizon is a PAID fact — the instant an actually-received payment covered
 * through — so it persists after `subscription.canceled` revokes the row. Cancel means the bound
 * stops EXTENDING; it never shrinks, so a buyer's fresh re-mint and their saved stale token agree
 * (no old-token/new-token divergence). A REFUNDED pair can never leak through this: the refund
 * revokes the one_time backing, so the pair drops out of the claim loops entirely (keys exist
 * only for active one_time rows). A legacy subscription row with a NULL `updates_expires_at`
 * (granted before the horizon stamp shipped) contributes nothing until its next renewal stamps it.
 */
async function subscriptionCoverageHorizons(
  tx: TenantExecutor,
  accountId: string,
): Promise<Map<string, number>> {
  const r = await tx.query<{ entitlement_id: string; horizon: string | Date }>(
    `SELECT entitlement_id, max(updates_expires_at) AS horizon
       FROM entitlement_grant
      WHERE account_id = $1 AND source_kind = 'subscription'
        AND updates_expires_at IS NOT NULL
      GROUP BY entitlement_id`,
    [accountId],
  );
  const horizons = new Map<string, number>();
  for (const row of r.rows) {
    const horizon = new Date(row.horizon).getTime();
    for (const spelling of entitlementIdAliasGroup(row.entitlement_id)) {
      const existing = horizons.get(spelling);
      if (existing === undefined || horizon > existing) {
        horizons.set(spelling, horizon);
      }
    }
  }
  return horizons;
}

/**
 * Compute the account's PER-ENTITLEMENT updates-window bounds for the signed `updatesWindows`
 * claim (ADR-0255 Decision 2), from DB truth over the ACTIVE one_time grants: per
 * `(account, entitlement)` pair, each row's bound is `updates_expires_at` where a renewal set it,
 * else `granted_at + 12 months`, and the pair takes its MOST FAVORABLE (max) row — so a duplicate
 * re-purchase starts a fresh 12 months rather than inheriting the oldest purchase's window, the
 * per-pair mirror of ADR-0255 Decision 3's most-favorable-window rule. A pair ALSO backed by an
 * ACTIVE subscription grant carrying a coverage horizon takes the MAX of its own bound and that
 * horizon (ADR-0269 Decision 2, hardened 2026-07-06 — the key is EXTENDED to the last paid
 * period's end, never dropped: a dropped key read as unbounded in a perpetual offline-verified
 * token that no cancel could claw back, audit P1 2). The stored one_time bound is untouched, so
 * once the subscription stops extending horizons the pair's bound converges back to it at the
 * next re-mint. Returns a `purchasedEntitlementId → ISO instant` map; EMPTY when the account
 * holds no active one-time grants — an unbounded claim (subscription-only accounts keep their
 * existing expiry semantics, ADR-0244 §4; subscription-sourced entitlements never get a key).
 * Deterministic for a fixed grant set (horizons are STAMPED at grant time, no read-time `now()`),
 * so the /issue re-mint comparison is stable. Run inside `withTenant`.
 */
export async function computeUpdatesWindows(
  tx: TenantExecutor,
  accountId: string,
): Promise<Record<string, string>> {
  const r = await tx.query<{
    entitlement_id: string;
    bound: string | Date;
  }>(UPDATES_WINDOWS_READ_SQL, [accountId]);
  const horizons = await subscriptionCoverageHorizons(tx, accountId);
  const windows: Record<string, string> = {};
  for (const row of r.rows) {
    const own = new Date(row.bound).getTime();
    // ADR-0269 (hardened): a subscription-covered pair's bound EXTENDS to the coverage horizon.
    const horizon = horizons.get(row.entitlement_id);
    windows[row.entitlement_id] = new Date(
      horizon !== undefined && horizon > own ? horizon : own,
    ).toISOString();
  }
  return windows;
}

/**
 * Compute the account's PER-ENTITLEMENT snapshot-at-sale instants for the signed `entitledSince`
 * claim (ADR-0257 §1.2 / ADR-0247 F7) — the SIBLING of {@link computeUpdatesWindows} on the
 * member-set axis. From DB truth over the ACTIVE one_time grants: per `(account, entitlement)` pair,
 * `entitledSince` is the MOST FAVORABLE (max) `granted_at` — a buyer who re-purchased a bundle is
 * entitled to the newer (larger) member snapshot, mirroring the most-favorable rule
 * `computeUpdatesWindows`/ADR-0255 Decision 3 use for windows. A member that joined a bundle AFTER
 * this instant is outside the buyer's snapshot; the per-member filter drops it at the registry-schema
 * resolver (`expandEntitlements`). A pair ALSO backed by an ACTIVE subscription grant carrying a
 * coverage horizon takes the MAX of its own instant and that horizon (ADR-0269 Decision 2,
 * hardened 2026-07-06 — while covered, members joining before the last PAID period's end reach the
 * buyer and stay grandfathered; a dropped key read as fully unbounded in a perpetual token that no
 * cancel could claw back, audit P1 2). Returns a `purchasedEntitlementId → ISO instant` map; EMPTY
 * when the account holds no active one-time grants (an unbounded/grandfathered claim —
 * subscription-sourced entitlements never get a key, their own `expiry` governs). Deterministic
 * for a fixed grant set (horizons are STAMPED at grant time, no read-time `now()`), so the /issue
 * re-mint comparison is stable. Run inside `withTenant`.
 */
export async function computeEntitledSince(
  tx: TenantExecutor,
  accountId: string,
): Promise<Record<string, string>> {
  const r = await tx.query<{
    entitlement_id: string;
    since: string | Date;
  }>(
    `SELECT entitlement_id, max(granted_at) AS since
       FROM entitlement_grant
      WHERE account_id = $1 AND source_kind = 'one_time' AND status = 'active'
      GROUP BY entitlement_id`,
    [accountId],
  );
  const horizons = await subscriptionCoverageHorizons(tx, accountId);
  const entitledSince: Record<string, string> = {};
  for (const row of r.rows) {
    const own = new Date(row.since).getTime();
    // ADR-0269 (hardened): a subscription-covered pair's snapshot EXTENDS to the coverage horizon.
    const horizon = horizons.get(row.entitlement_id);
    entitledSince[row.entitlement_id] = new Date(
      horizon !== undefined && horizon > own ? horizon : own,
    ).toISOString();
  }
  return entitledSince;
}

export interface ExtendUpdatesWindowInput {
  /** The buyer account — MUST equal the `withTenant` scope (the RLS WITH CHECK enforces it). */
  accountId: string;
  /** The renewed purchased id (RENEWAL_BOOK `renewsEntitlement`). */
  entitlementId: string;
  /** The renewal purchase's transaction id — BOTH the fail-closed-throw audit context AND the
   *  `renewal_extension` ledger's `purchase_id` (the join key a later refund reverses on). */
  sourceEventId: string;
  /** The renewal LINE's Paddle `txnitm_` id (ADR-0218 per-line join key) — recorded so a per-line
   *  refund can un-extend exactly this renewal. Omitted / "" for a single-line renewal or a driver
   *  with no per-line data; a whole-transaction refund reverses by `purchase_id` alone regardless. */
  lineItemId?: string;
  /** The renewal tenor in years (RENEWAL_BOOK's multi-year lever / `renewalYears()`, R6 rider) —
   *  defaults to 1 (12 months) when omitted, matching every pre-multi-year renewal row. Integer
   *  years only; the window extends by `12 * years` months in ONE step (not `years` stacked
   *  single-year extensions), so a lapsed-window renewal only backfills one base window, same as
   *  today's 1-year case. */
  years?: number;
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
 *
 * ALIAS-TOLERANT match (ADR-0257 convergence, W7): `resolveRenewal` hands back the CANONICAL id,
 * but grants written under the pre-0257 vocabulary store the LEGACY id (`ai-kit`, `bundle`, …).
 * The match spans the whole alias group so a legacy buyer's renewal extends their legacy-keyed
 * grant instead of fail-closed-throwing on the canonical spelling.
 *
 * MULTI-YEAR lever (R6 rider): `input.years` (default 1) multiplies the extension to `12 * years`
 * months in ONE `make_interval` step — a 2-year renewal stacks 24 months onto the remaining window
 * exactly like the 1-year case stacks 12, never two separate 12-month stacks. FAIL-CLOSED on a
 * non-positive-integer `years` (a malformed RENEWAL_BOOK row must never silently extend by zero
 * or a fractional amount).
 */
export async function extendUpdatesWindow(
  tx: TenantExecutor,
  input: ExtendUpdatesWindowInput,
): Promise<number> {
  const years = input.years ?? 1;
  if (!Number.isInteger(years) || years < 1) {
    throw new ConfigError(
      `extendUpdatesWindow years must be a positive integer, got ${years}`,
    );
  }
  const months = 12 * years;
  const r = await tx.query<{ id: string }>(
    `UPDATE entitlement_grant
       SET updates_expires_at =
             GREATEST(now(), COALESCE(updates_expires_at, granted_at + interval '12 months'))
             + make_interval(months => $3::int)
     WHERE account_id = $1
       AND entitlement_id = ANY($2::text[])
       AND source_kind = 'one_time'
       AND status = 'active'
     RETURNING id`,
    [input.accountId, entitlementIdAliasGroup(input.entitlementId), months],
  );
  if (r.rows.length === 0) {
    throw new ConfigError(
      `renewal ${input.sourceEventId} extends no active one_time grant for entitlement ${input.entitlementId}`,
    );
  }
  // Record the extension so a later refund can un-extend exactly it (ADR-0251 Consequences). Keyed on
  // (account, entitlement, purchase, line) — ON CONFLICT DO NOTHING so a redelivery (already blocked
  // by the outer processEvent claim) can never write a second row. The stored `entitlement_id` is the
  // CANONICAL renewsEntitlement; the reversal alias-folds it back onto legacy-keyed grant rows, same
  // as the extend UPDATE above.
  await tx.query(
    `INSERT INTO renewal_extension
       (id, account_id, entitlement_id, purchase_id, line_item_id, months)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (account_id, entitlement_id, purchase_id, line_item_id) DO NOTHING`,
    [
      randomUUID(),
      input.accountId,
      input.entitlementId,
      input.sourceEventId,
      input.lineItemId ?? "",
      months,
    ],
  );
  return r.rows.length;
}

export interface ReverseRenewalExtensionsInput {
  /** The buyer account — MUST equal the `withTenant` scope. */
  accountId: string;
  /** The refunded transaction id — the `renewal_extension.purchase_id` written at renewal time
   *  (`refund.completed`'s `paymentId` joins back to it, ADR-0108/0113). */
  purchaseId: string;
  /** When set (a per-line full refund), reverse ONLY the renewal lines whose `txnitm_` is in this
   *  set; omitted (a whole-transaction full refund) reverses EVERY active renewal extension from the
   *  purchase. A dollar-partial refund never reverses (a renewal SKU is all-or-nothing — the caller
   *  passes only fully-refunded line ids). */
  lineItemIds?: readonly string[];
}

/**
 * Un-extend the updates window a refunded renewal SKU had granted (ADR-0251 Consequences —
 * previously an unbuilt follow-up). For each ACTIVE `renewal_extension` ledger row this refund
 * matches, shrink the renewed pair's active one_time grant rows by that row's stored renewal tenor
 * (`months`, with legacy NULL rows defaulting to 12), FLOORED at the original purchase window
 * (`granted_at + 12 months`) so the window can never dip BELOW what the buyer originally bought —
 * then LATCH the ledger row `reversed`, so a redelivered or sibling refund event (e.g. a partial
 * then a whole-transaction adjustment) never double-shrinks it (idempotent). Alias-tolerant: the
 * ledger's canonical `entitlement_id` matches legacy-keyed grant rows via the alias group (the
 * extend/window-read convention). Returns the number of extensions reversed. Run inside
 * `withTenant`.
 *
 * // ponytail: the shrink subtracts the stored tenor rather than restoring a stored pre-value.
 * // Exact whenever the renewal was bought while the window was still live (the common case:
 * // `updates_expires_at - months` == the prior end). A renewal bought on a LAPSED window
 * // over-restores by the lapse gap (favoring the buyer, always ≥ baseline) — accepted rather than
 * // storing per-row before/after; upgrade to a stored pre-value only if lapsed-then-refunded
 * // exactness ever matters.
 */
export async function reverseRenewalExtensions(
  tx: TenantExecutor,
  input: ReverseRenewalExtensionsInput,
): Promise<number> {
  const rows =
    input.lineItemIds === undefined
      ? await tx.query<{
          id: string;
          entitlement_id: string;
          months: number;
        }>(
          `SELECT id, entitlement_id, COALESCE(months, 12) AS months
             FROM renewal_extension
             WHERE account_id = $1 AND purchase_id = $2 AND status = 'active'`,
          [input.accountId, input.purchaseId],
        )
      : await tx.query<{
          id: string;
          entitlement_id: string;
          months: number;
        }>(
          `SELECT id, entitlement_id, COALESCE(months, 12) AS months
             FROM renewal_extension
             WHERE account_id = $1 AND purchase_id = $2 AND status = 'active'
               AND line_item_id = ANY($3::text[])`,
          [input.accountId, input.purchaseId, [...input.lineItemIds]],
        );
  let reversed = 0;
  for (const row of rows.rows) {
    // Shrink the pair's window back one renewal interval, never below the original purchase window.
    // A revoked/absent grant (the original purchase itself was refunded) matches nothing — the
    // window is moot, but the ledger row is still latched below so the reversal is idempotent.
    await tx.query(
      `UPDATE entitlement_grant
         SET updates_expires_at = GREATEST(
               granted_at + interval '12 months',
               updates_expires_at - make_interval(months => $3::int))
       WHERE account_id = $1
         AND entitlement_id = ANY($2::text[])
         AND source_kind = 'one_time'
         AND status = 'active'
         AND updates_expires_at IS NOT NULL`,
      [
        input.accountId,
        entitlementIdAliasGroup(row.entitlement_id),
        row.months,
      ],
    );
    await tx.query(
      `UPDATE renewal_extension SET status = 'reversed', reversed_at = now() WHERE id = $1`,
      [row.id],
    );
    reversed += 1;
  }
  return reversed;
}

// --- G24: updates-window expiry notice (buyer-lifecycle audit 2026-07-07) ----------------------
//
// The credit-expiry sweep already has a T-30d "expiring soon" email (`@caisson/credits`); the
// updates window (ADR-0244/0255's per-entitlement `updates_expires_at`) had no equivalent — a
// one-time buyer discovered a lapsed window only by visiting `/dashboard/license` and seeing a
// passive "Lapsed" pill. This extends the SAME pattern: an append-only per-(account, entitlement,
// expiry) marker gates a one-time notice, mirroring `@caisson/credits`'s `credit_expiry_notice`
// (a marker table, never a mutated column). SEPARATE migration (never an edit to a frozen
// constant, ADR-0006 append-only). Keyed on the expiry INSTANT (not just the entitlement id) so a
// LATER renewal that pushes the window further out is a FRESH notice-eligible window — the
// marker never "sticks" across a renewal the way keying on the entitlement id alone would.

export const UPDATES_WINDOW_EXPIRY_NOTICE_SCHEMA_SQL = `
CREATE TABLE updates_window_expiry_notice (
  account_id text NOT NULL,
  entitlement_id text NOT NULL,
  updates_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, entitlement_id, updates_expires_at)
);
${buildTenantPolicySql("updates_window_expiry_notice")}
`;

/** The minimal structural slice of `@caisson/email`'s `Emailer` port — declared locally (mirrors
 *  `@caisson/credits`'s `ExpiryNoticeEmailer`) so this module needs no email dependency; any real
 *  `Emailer` satisfies it. */
export interface UpdatesWindowExpiryEmailer {
  send(msg: {
    to: string;
    template: string;
    data: Record<string, unknown>;
  }): Promise<void>;
}

export interface UpdatesWindowExpiryNoticeInput {
  /** Where the notice goes — resolved by the caller. */
  recipient: string;
  emailer: UpdatesWindowExpiryEmailer;
  /** The CTA link — the buyer license/dashboard page. */
  dashboardUrl: string;
  /** Notice window in days before expiry (defaults to 30, the credits-expiry precedent). */
  withinDays?: number;
}

/**
 * The T-30d updates-window expiry-notice sweep (G24): for each purchased id whose (raw one_time)
 * window expires within the notice window and has NOT been noticed for THIS exact expiry
 * instant, insert the append-only marker (`ON CONFLICT DO NOTHING`, PK is
 * `(account, entitlement, expiry)`) and send the `updates-window-expiring` email.
 * Notified-once-per-window: a replayed sweep inserts nothing and sends nothing; a later renewal
 * that changes the expiry instant is a fresh, distinct row. The send runs INSIDE the transaction
 * after the marker insert, so a failed send rolls the marker back and the next sweep retries.
 *
 * // ponytail: reads the RAW one_time bound only, not the subscription-coverage-horizon fold
 * // `computeUpdatesWindows` applies for the signed claim — a pair actively covered by a
 * // subscription is already safe (its horizon extends the real bound the issuer signs), so this
 * // conservative floor never sends a false "expiring" notice for a covered pair's underlying
 * // purchase; it can only under-notify the rare case where coverage alone would have pushed a
 * // near-floor purchase out of the window. Fold in `subscriptionCoverageHorizons` if that residual
 * // ever matters — it isn't exported today because nothing else needs it outside this file.
 *
 * Returns the number of notices sent. Run inside `withTenant`.
 */
export async function sweepUpdatesWindowExpiryNotices(
  tx: TenantExecutor,
  accountId: string,
  input: UpdatesWindowExpiryNoticeInput,
): Promise<number> {
  const withinDays = input.withinDays ?? 30;
  const cutoff = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);
  const due = await tx.query<{
    entitlement_id: string;
    bound: string | Date;
  }>(
    `SELECT entitlement_id, max(updates_expires_at) AS bound
       FROM entitlement_grant
      WHERE account_id = $1 AND source_kind = 'one_time' AND status = 'active'
        AND updates_expires_at IS NOT NULL
      GROUP BY entitlement_id
     HAVING max(updates_expires_at) > now() AND max(updates_expires_at) <= $2`,
    [accountId, cutoff],
  );
  let sent = 0;
  for (const row of due.rows) {
    const expiresAt =
      row.bound instanceof Date ? row.bound : new Date(String(row.bound));
    const marked = await tx.query<{ account_id: string }>(
      `INSERT INTO updates_window_expiry_notice (account_id, entitlement_id, updates_expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING
       RETURNING account_id`,
      [accountId, row.entitlement_id, expiresAt.toISOString()],
    );
    if (marked.rows.length === 0) continue; // raced/replayed — already noticed for this exact expiry
    await input.emailer.send({
      to: input.recipient,
      template: "updates-window-expiring",
      data: {
        entitlementId: row.entitlement_id,
        expiresOn: expiresAt.toISOString().slice(0, 10),
        url: input.dashboardUrl,
      },
    });
    sent += 1;
  }
  return sent;
}

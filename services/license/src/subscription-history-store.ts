// ADR-0293 — in-app subscription management: a subscription-lifecycle signal plus an append-only
// order/invoice ledger, both written at webhook time.
//
// G13: `entitlement_grant` only carries PURCHASED-ID rows, and a `coversOwnedEntitlements` plan
// (Developer) grants `entitlements: []` (ADR-0269 Decision 3) — so an active Developer subscription
// leaves NO row an "owned" check can find (`[].every(...)` is vacuously `true`, which would false-
// positive EVERY account). `subscription_status` is the minimal signal: one row per subscription id,
// latest lifecycle state, upserted on every granting invoice and flipped on cancel. Written for EVERY
// subscription plan (not just zero-entitlement ones) so the SAME table also answers G14's "which
// subscription backs this price id, and is it still active" — a plan that also grants entitlement
// rows keeps using those as its primary ownership signal; this table is the uniform cancel-lookup.
//
// G26: no table anywhere records a purchase's price/amount/currency for buyer-facing display
// (`entitlement_grant`/`credit_event` carry credits and purchased ids, never dollars or a price id).
// `order_record` is the thin append-only ledger the dashboard's Invoices view reads: one row per
// granting invoice / one-time transaction, flipped to 'refunded' on a whole-transaction refund.
//
// Both tenant-owned + fail-closed RLS via @caisson/tenancy-rls (ADR-0005), written inside the SAME
// withTenant transaction apply-billing-event.ts already runs its grants in.
import { randomUUID } from "node:crypto";
import {
  ORDER_RECORDS_READ_SQL,
  SUBSCRIPTION_STATUSES_READ_SQL,
} from "@caisson/platform-reads";
import { buildTenantPolicySql } from "@caisson/tenancy-rls";
import type { TenantExecutor } from "@caisson/tenancy-rls";

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

// --- G13/G14: subscription lifecycle status ------------------------------------------------------

export const SUBSCRIPTION_STATUS_SCHEMA_SQL = `
CREATE TABLE subscription_status (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  subscription_id text NOT NULL,
  price_id text NOT NULL,
  plan_tag text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_status_status CHECK (status IN ('active', 'canceled'))
);

-- Scoped to (account_id, subscription_id) — NOT subscription_id alone. Paddle subscription ids are
-- globally unique in practice, but account-scoping the uniqueness (matching entitlement_grant_uniq's
-- convention) means a webhook payload carrying an unexpected cross-account id can never RLS-deny a
-- DIFFERENT account's legitimate upsert by colliding on someone else's row — each account gets its
-- own row regardless of what any other tenant's data holds.
CREATE UNIQUE INDEX subscription_status_account_subscription_uniq
  ON subscription_status (account_id, subscription_id);

${buildTenantPolicySql("subscription_status")}
`;

export interface UpsertSubscriptionStatusInput {
  accountId: string;
  subscriptionId: string;
  priceId: string;
  planTag: string;
}

/**
 * Record/refresh an ACTIVE subscription at grant time — the G13 signal `/dashboard/plan` reads to
 * stop offering a second subscribe on a zero-entitlement plan (Developer), and the G14 signal the
 * cancel route reads to resolve a buyer-owned price id to its Paddle subscription id. ON CONFLICT
 * re-stamps `price_id`/`plan_tag` to the LATEST invoice's values (not just `status`/`updated_at`) —
 * a plan change on the same Paddle subscription id (upgrade/downgrade) must move the row onto the
 * new price, or the old plan keeps reading "owned" with a cancel control while the new plan reads
 * unowned with none (review WR-02). Also re-activates a row a prior cancel had flipped (a
 * resubscribe on the SAME subscription id — a Paddle resume, not a fresh checkout). Run inside
 * `withTenant`.
 */
export async function upsertSubscriptionStatus(
  tx: TenantExecutor,
  input: UpsertSubscriptionStatusInput,
): Promise<void> {
  await tx.query(
    `INSERT INTO subscription_status (id, account_id, subscription_id, price_id, plan_tag, status, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'active', now())
     ON CONFLICT (account_id, subscription_id)
     DO UPDATE SET status = 'active',
                    price_id = EXCLUDED.price_id,
                    plan_tag = EXCLUDED.plan_tag,
                    updated_at = now()`,
    [
      randomUUID(),
      input.accountId,
      input.subscriptionId,
      input.priceId,
      input.planTag,
    ],
  );
}

/**
 * Flip a subscription's status row to 'canceled' — and when NO row exists for this (account,
 * subscription) pair, INSERT a canceled TOMBSTONE (empty price_id/plan_tag sentinels; every
 * consumer filters on `status = 'active'`, so a tombstone never renders or resolves a price).
 * The tombstone is what closes the static-grant ordering race: a `subscription.canceled`
 * delivered BEFORE its subscription's first granting invoice used to leave nothing behind, so
 * the late `invoice.paid` minted grant rows no later event would ever revoke — the grant-time
 * liveness check ({@link readSubscriptionStatus} in apply-billing-event) now finds this row and
 * refuses the entitlement grant. Scoped by BOTH account and subscription id (never subscription
 * id alone — see the schema comment) so a cancel for one account can never touch a same-id row
 * under another. The conflict UPDATE only touches status/updated_at — a real row's
 * price_id/plan_tag are never overwritten with sentinels. Run inside `withTenant`.
 */
export async function cancelSubscriptionStatus(
  tx: TenantExecutor,
  accountId: string,
  subscriptionId: string,
): Promise<void> {
  await tx.query(
    `INSERT INTO subscription_status (id, account_id, subscription_id, price_id, plan_tag, status, updated_at)
     VALUES ($1, $2, $3, '', '', 'canceled', now())
     ON CONFLICT (account_id, subscription_id)
     DO UPDATE SET status = 'canceled', updated_at = now()`,
    [randomUUID(), accountId, subscriptionId],
  );
}

/**
 * Read ONE (account, subscription) pair's lifecycle status — the grant-time liveness check
 * `invoice.paid` runs before minting subscription grants (see {@link cancelSubscriptionStatus}).
 * `null` = no row (the subscription has never granted nor canceled here). Run inside `withTenant`.
 */
export async function readSubscriptionStatus(
  tx: TenantExecutor,
  accountId: string,
  subscriptionId: string,
): Promise<"active" | "canceled" | null> {
  const r = await tx.query<{ status: "active" | "canceled" }>(
    `SELECT status FROM subscription_status
      WHERE account_id = $1 AND subscription_id = $2`,
    [accountId, subscriptionId],
  );
  return r.rows[0]?.status ?? null;
}

export interface SubscriptionStatusRow {
  subscriptionId: string;
  priceId: string;
  planTag: string;
  status: "active" | "canceled";
  updatedAt: string;
}

/**
 * Every subscription-status row for the account, newest-updated first — the G13 "owned" read for a
 * zero-entitlement plan, and the G14 cancel route's ownership + subscription-id lookup. Run inside
 * `withTenant`.
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
  }>(SUBSCRIPTION_STATUSES_READ_SQL, [accountId]);
  return r.rows.map((row) => ({
    subscriptionId: row.subscription_id,
    priceId: row.price_id,
    planTag: row.plan_tag,
    status: row.status,
    updatedAt: toIso(row.updated_at),
  }));
}

// --- G26: order/invoice history -------------------------------------------------------------------

export const ORDER_RECORD_SCHEMA_SQL = `
CREATE TABLE order_record (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  source_event_id text NOT NULL,
  kind text NOT NULL,
  price_id text,
  label text NOT NULL,
  amount integer NOT NULL,
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'paid',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_record_kind CHECK (kind IN ('subscription', 'purchase')),
  CONSTRAINT order_record_status CHECK (status IN ('paid', 'refunded')),
  CONSTRAINT order_record_amount_nonneg CHECK (amount >= 0)
);

CREATE UNIQUE INDEX order_record_source_event_uniq ON order_record (source_event_id, kind);

${buildTenantPolicySql("order_record")}
`;

// The subscription linkage + coverage-contribution columns (review R2 fixes). `subscription_id`
// records WHICH subscription a kind='subscription' invoice row belongs to at insert time — the
// refund-time coverage-horizon claw used to re-derive it by matching the row's price id against
// `subscription_status`, and an account that canceled a subscription and later re-subscribed to
// the SAME price has two status rows with that price id, so the claw could shrink the LIVE
// subscription's horizon over a refund of the old one's invoice. `coverage_stamped` records
// whether the invoice actually extended the coverage horizon: a canceled-before-grant late
// invoice (see the grant-time liveness check in apply-billing-event.ts) grants credits only and
// stamps nothing, so a refund of it must roll back nothing — without the bit, the claw would
// shrink a horizon EARLIER un-refunded payments paid for. Backfill semantics for pre-column
// rows: `coverage_stamped` defaults true (every pre-column subscription invoice stamped
// unconditionally — the historically accurate value) and `subscription_id` stays NULL, which the
// claw treats as "unresolvable — skip, log" (the pre-column ambiguity is exactly what it refuses
// to guess through). SEPARATE migration, never an edit to ORDER_RECORD_SCHEMA_SQL above — that
// constant is frozen as the checksum-pinned platform migration (append-only, ADR-0006).
export const ORDER_RECORD_SUBSCRIPTION_LINK_MIGRATION_SQL = `
ALTER TABLE order_record ADD COLUMN subscription_id text;
ALTER TABLE order_record ADD COLUMN coverage_stamped boolean NOT NULL DEFAULT true;
`;

// ADR-0315 affiliate attribution: the Paddle discount id (`dsc_…`) this order redeemed — the join
// key the affiliate commission report resolves against `affiliate_code.discount_id`. Nullable, no
// default: an undiscounted order (the norm) and every row that predates this column stay NULL
// (backfill honesty is the report's label job — the report simply never attributes a NULL row).
// SEPARATE migration, never an edit to the checksum-pinned ORDER_RECORD_SCHEMA_SQL above (append-
// only, ADR-0006) — mirrors ORDER_RECORD_SUBSCRIPTION_LINK_MIGRATION_SQL's append pattern.
export const ORDER_RECORD_DISCOUNT_MIGRATION_SQL = `
ALTER TABLE order_record ADD COLUMN discount_id text;
`;

export interface InsertOrderRecordInput {
  accountId: string;
  /** The invoice id (subscription) / payment id (one-time) — the same anchor the credit/entitlement
   *  grants for this event key on. */
  sourceEventId: string;
  kind: "subscription" | "purchase";
  /** Null for a multi-line cart (no single price id represents the whole order). */
  priceId: string | null;
  label: string;
  /** Integer minor currency units (ADR-0007) — the event's own `amountTotal`, never re-derived. */
  amount: number;
  currency: string;
  /** The backing subscription (kind='subscription' rows) — the refund claw's unambiguous target.
   *  Omitted/null for purchases; a NULL on a subscription row makes the claw skip, never guess. */
  subscriptionId?: string | null;
  /** False when this invoice deliberately stamped NO coverage horizon (the canceled-before-grant
   *  path) — a refund of it then rolls back nothing. Defaults true (the normal granting invoice). */
  coverageStamped?: boolean;
  /** ADR-0315: the redeemed Paddle discount id (`dsc_…`) — the affiliate report's join key.
   *  Omitted/null for an undiscounted order. */
  discountId?: string | null;
}

/**
 * Append one paid order/invoice row (G26) — idempotent on (source_event_id, kind): a webhook
 * redelivery of the same invoice/transaction inserts nothing a second time (belt-and-suspenders next
 * to the outer `processEvent` claim, ADR-0229). Run inside `withTenant`.
 *
 * A NEGATIVE `amount` (a Paddle credit-note-adjusted invoice, or any other provider oddity) is
 * skipped, not thrown (review IN-02): `order_record_amount_nonneg` would otherwise reject the row
 * and roll back the WHOLE billing-event transaction — including the real credit/entitlement grant
 * this event carries — turning a cosmetic history-row failure into a permanent non-2xx that Paddle
 * retries forever. This mirrors the rest of the event parser's fail-soft posture on oddities that
 * grant nothing (e.g. an unrecognized adjustment item is skipped + logged, never thrown): the order
 * history simply omits the row rather than blocking the grant.
 */
export async function insertOrderRecord(
  tx: TenantExecutor,
  input: InsertOrderRecordInput,
): Promise<void> {
  if (input.amount < 0) {
    process.stderr.write(
      `[service-license] order_record: skipping negative-amount row (sourceEventId=${input.sourceEventId}, amount=${String(input.amount)}) — grant unaffected\n`,
    );
    return;
  }
  await tx.query(
    `INSERT INTO order_record (id, account_id, source_event_id, kind, price_id, label, amount, currency, subscription_id, coverage_stamped, discount_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (source_event_id, kind) DO NOTHING`,
    [
      randomUUID(),
      input.accountId,
      input.sourceEventId,
      input.kind,
      input.priceId,
      input.label,
      input.amount,
      input.currency,
      input.subscriptionId ?? null,
      input.coverageStamped ?? true,
      input.discountId ?? null,
    ],
  );
}

/**
 * Flip a purchase's order row to 'refunded' on a WHOLE-transaction refund — a no-op if the purchase
 * predates this table, or was already flipped by a redelivered refund event. Scoped to `kind =
 * 'purchase'`: a subscription's per-cycle invoice rows are untouched by any refund event (a
 * subscription's own lifecycle is `subscription_status`, not a per-invoice refund flag).
 *
 * // ponytail: a PER-LINE partial refund (ADR-0218) does not flip this — v1 order history shows the
 * // order as still 'paid' until/unless it is fully refunded. Add per-line status if a partial refund
 * // ever needs its own row in the buyer-facing history.
 *
 * Run inside `withTenant`.
 */
export async function refundOrderRecord(
  tx: TenantExecutor,
  paymentId: string,
): Promise<void> {
  await tx.query(
    `UPDATE order_record SET status = 'refunded'
      WHERE source_event_id = $1 AND kind = 'purchase' AND status = 'paid'`,
    [paymentId],
  );
}

/**
 * Flip a SUBSCRIPTION invoice's order row to 'refunded' on a whole-transaction refund of that
 * payment — the SIBLING of {@link refundOrderRecord} for `kind = 'subscription'` rows, returning
 * the flipped row's `price_id`, its `subscription_id` (the claw's unambiguous rollback target —
 * NULL on a pre-link row, which the caller skips rather than re-deriving by price), and its
 * `coverage_stamped` bit (false = the invoice stamped no horizon, so nothing to roll back). `null`
 * when nothing flipped: the refunded payment was not a subscription invoice, predates this table,
 * or was already flipped by a redelivery. The paid→refunded transition is the LATCH the
 * coverage-horizon rollback keys on: a redelivered refund event flips nothing and therefore rolls
 * nothing back a second time. Run inside `withTenant`.
 */
export async function refundSubscriptionOrderRecord(
  tx: TenantExecutor,
  paymentId: string,
): Promise<{
  priceId: string | null;
  subscriptionId: string | null;
  coverageStamped: boolean;
} | null> {
  const r = await tx.query<{
    price_id: string | null;
    subscription_id: string | null;
    coverage_stamped: boolean;
  }>(
    `UPDATE order_record SET status = 'refunded'
      WHERE source_event_id = $1 AND kind = 'subscription' AND status = 'paid'
      RETURNING price_id, subscription_id, coverage_stamped`,
    [paymentId],
  );
  const row = r.rows[0];
  return row === undefined
    ? null
    : {
        priceId: row.price_id,
        subscriptionId: row.subscription_id,
        coverageStamped: row.coverage_stamped,
      };
}

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

/** Every order/invoice row for the account, newest first — the G26 dashboard Invoices view. Run
 *  inside `withTenant`. */
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
  }>(ORDER_RECORDS_READ_SQL, [accountId]);
  return r.rows.map((row) => ({
    sourceEventId: row.source_event_id,
    kind: row.kind,
    priceId: row.price_id,
    label: row.label,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    createdAt: toIso(row.created_at),
  }));
}

// The abandoned-checkout email feature's storage (SPEC outputs/specs/deferred-respec/
// SPEC-abandoned-checkout-email.md, operator-locked 2026-07-10: N=24h delay, implicit consent,
// env-gated discount). Two append-only tables:
//   • checkout_abandonment — one row per `POST /api/checkout/started` (apps/site), fed the moment a
//     signed-in buyer opens the Paddle overlay. Tenant-owned (ADR-0005).
//   • checkout_abandonment_notice — the per-row already-notified marker (ON CONFLICT DO NOTHING),
//     mirroring `@caisson/credits`'s `credit_expiry_notice` shape exactly: PK is the SUBJECT id
//     (the checkout_abandonment row this notice covers), account_id carried for the tenant policy
//     + the 30-day cross-row suppression read.
//
// Both tenant-owned + fail-closed RLS via @caisson/tenancy-rls (ADR-0005). Ships as the checksum-
// pinned platform migration `0024_checkout_abandonment.sql` (@caisson/platform-migrations) —
// SEPARATE migration from any future change here (ADR-0006 append-only).
import { buildTenantPolicySql } from "@caisson/tenancy-rls";
import type { TenantExecutor, Transactor } from "@caisson/tenancy-rls";
import { withAdminWrite } from "@caisson/org-controls";

export const CHECKOUT_ABANDONMENT_SCHEMA_SQL = `
CREATE TABLE checkout_abandonment (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  items jsonb NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX checkout_abandonment_account_started_idx ON checkout_abandonment (account_id, started_at);

${buildTenantPolicySql("checkout_abandonment")}
`;

export const CHECKOUT_ABANDONMENT_NOTICE_SCHEMA_SQL = `
CREATE TABLE checkout_abandonment_notice (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX checkout_abandonment_notice_account_created_idx ON checkout_abandonment_notice (account_id, created_at);

${buildTenantPolicySql("checkout_abandonment_notice")}
`;

/** One cart line as captured at checkout-start (id + label only — `apps/site/lib/cart.ts`'s
 *  `CartItem` also carries priceId/amount/kind, but the email only ever displays the label). */
export interface CheckoutAbandonmentLine {
  id: string;
  label: string;
}

export interface RecordCheckoutAbandonmentInput {
  id: string;
  accountId: string;
  items: readonly CheckoutAbandonmentLine[];
}

/** Insert one checkout-started row. Run inside `withTenant` (apps/site's `readScoped`). */
export async function recordCheckoutAbandonment(
  tx: TenantExecutor,
  input: RecordCheckoutAbandonmentInput,
): Promise<void> {
  await tx.query(
    `INSERT INTO checkout_abandonment (id, account_id, items) VALUES ($1, $2, $3::jsonb)`,
    [input.id, input.accountId, JSON.stringify(input.items)],
  );
}

/**
 * Every distinct account holding a checkout_abandonment row old enough to be notice-eligible
 * (`started_at <= now() - delayHours`), read cross-tenant via the already-provisioned
 * `admin_write` role's SELECT-only policy on this table (mirrors `listWalletAccountIds`/
 * `listUpdatesWindowAccountIds` in credit-expiry-scheduler.ts — the daily tick has no account
 * context yet). Deterministic order so a test asserting the list needs no sort.
 */
export async function listAbandonedCheckoutAccountIds(
  db: Transactor,
  delayHours: number,
): Promise<string[]> {
  const cutoff = new Date(Date.now() - delayHours * 60 * 60 * 1000);
  return withAdminWrite(db, async (tx) => {
    const r = await tx.query<{ account_id: string }>(
      `SELECT DISTINCT account_id FROM checkout_abandonment WHERE started_at <= $1 ORDER BY account_id`,
      [cutoff.toISOString()],
    );
    return r.rows.map((row) => row.account_id);
  });
}

function parseItems(raw: unknown): CheckoutAbandonmentLine[] {
  if (!Array.isArray(raw)) return [];
  const lines: CheckoutAbandonmentLine[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const { id, label } = entry as Record<string, unknown>;
    if (typeof id === "string" && typeof label === "string") {
      lines.push({ id, label });
    }
  }
  return lines;
}

export interface SweepAbandonedCheckoutResult {
  lines: readonly CheckoutAbandonmentLine[];
}

/**
 * Per-account sweep: find the OLDEST checkout_abandonment row that is (1) past the delay window,
 * (2) not converted since (no `order_record` row for this account created after `started_at` — the
 * same "a purchase landed" signal apply-billing-event's grant path writes for every granting
 * invoice/one-time transaction, G26; entitlement_grant alone would miss a zero-entitlement
 * Developer-plan conversion), and (3) suppressed by NEITHER a prior notice for the SAME row NOR any
 * notice for this account within the last 30 days (spec §c: one nudge per rolling month). On a hit,
 * marks it via an append-only marker row keyed on the SUBJECT id (ON CONFLICT DO NOTHING,
 * `credit_expiry_notice`'s shape) so a concurrent or replayed sweep never double-marks the same
 * row; returns `null` when nothing is eligible or the marker insert lost the race. Run inside
 * `withTenant`.
 *
 * // ponytail: the marker commits in THIS function's own statement; the caller sends the email
 * // AFTER this returns (detached, mirroring `notifyPurchaseEmail`'s post-commit contract) rather
 * // than nesting the send inside this same SQL transaction the way
 * // `sweepUpdatesWindowExpiryNotices` does — a send failure after this commits is a silent miss,
 * // not a retry. Acceptable for a one-time, low-stakes nudge (not a money path); thread a
 * // structural emailer through here instead if guaranteed delivery ever matters.
 */
export async function sweepEligibleAbandonedCheckout(
  tx: TenantExecutor,
  accountId: string,
  delayHours: number,
): Promise<SweepAbandonedCheckoutResult | null> {
  const recentNotice = await tx.query<{ id: string }>(
    `SELECT id FROM checkout_abandonment_notice
      WHERE account_id = $1 AND created_at > now() - interval '30 days'
      LIMIT 1`,
    [accountId],
  );
  if (recentNotice.rows.length > 0) return null;

  const cutoff = new Date(Date.now() - delayHours * 60 * 60 * 1000);
  const due = await tx.query<{ id: string; items: unknown }>(
    `SELECT ca.id, ca.items
       FROM checkout_abandonment ca
      WHERE ca.account_id = $1
        AND ca.started_at <= $2
        AND NOT EXISTS (
          SELECT 1 FROM order_record o
           WHERE o.account_id = ca.account_id AND o.created_at > ca.started_at
        )
        AND NOT EXISTS (
          SELECT 1 FROM checkout_abandonment_notice n WHERE n.id = ca.id
        )
      ORDER BY ca.started_at ASC
      LIMIT 1`,
    [accountId, cutoff.toISOString()],
  );
  const row = due.rows[0];
  if (row === undefined) return null;

  const marked = await tx.query<{ id: string }>(
    `INSERT INTO checkout_abandonment_notice (id, account_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING RETURNING id`,
    [row.id, accountId],
  );
  if (marked.rows.length === 0) return null; // raced/replayed — someone else already sent it

  return { lines: parseItems(row.items) };
}

/**
 * Whether `accountId` has a checkout_abandonment_notice within the last `withinDays` days — the
 * `abandoned_checkout_converted` PostHog event's grant-time precondition (spec §e: "read at grant
 * time, not a new counter"), reading back the SAME marker table the sweep writes. Run inside
 * `withTenant`.
 */
export async function hasRecentAbandonedCheckoutNotice(
  tx: TenantExecutor,
  accountId: string,
  withinDays = 14,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000);
  const r = await tx.query<{ id: string }>(
    `SELECT id FROM checkout_abandonment_notice WHERE account_id = $1 AND created_at > $2 LIMIT 1`,
    [accountId, cutoff.toISOString()],
  );
  return r.rows.length > 0;
}

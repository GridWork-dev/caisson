// ADR-0315 — the affiliate program's operator store: the minted-discount-code registry plus the
// commission report the admin cockpit reads. An affiliate gets a Paddle percentage discount code
// (10% buyer-facing) minted through the billing driver's `createDiscount`; its `dsc_…` id is the
// join key. Every purchase/cycle invoice that redeemed the code stamps `order_record.discount_id`
// (apply-billing-event.ts), so joining `order_record.discount_id → affiliate_code.discount_id`
// attributes revenue to the affiliate and computes their 30% commission.
//
// `affiliate_code` is an ADMIN/operator table — NOT tenant-scoped (an affiliate spans every buyer
// account). It mirrors `admin_action_log`'s posture (services/license/src/admin-audit-log.ts): no
// RLS tenant policy, access is ROLE-gated — `admin_write` INSERTs (the mint), the read-only `admin`
// role SELECTs (the report), the buyer `app` role is granted nothing. The GRANTs are role-GUARDED
// (unlike admin_action_log's bare grants) because this table's DDL ships in the platform migration
// chain (packages/platform-migrations 0026), which may run BEFORE the admin roles are provisioned
// on a fresh DB — the guard makes the migration succeed either way; on the live DB (roles present)
// the grants apply at migration time, mirroring the `rate_limit` absence-guard in that same chain.
//
// The commission report is CROSS-TENANT: it reads every tenant's `order_record` rows, so the caller
// runs it as the read-only `admin` role (withAdminRead) — which needs a cross-tenant read policy on
// `order_record` (an admin-provisioning concern, ADR-0141). This module holds only the store SQL;
// the RLS/role scoping is the caller's.
import { randomUUID } from "node:crypto";
import type { TenantExecutor } from "@caisson/tenancy-rls";

/** The LOCKED affiliate commission — 3000 basis points = 30% (operator lock, ADR-0315). Fixed
 *  program parameter, never a per-mint input. */
export const AFFILIATE_COMMISSION_BPS = 3000;

/** The LOCKED buyer-facing discount — 10% (operator lock, ADR-0315). Fixed; the Paddle driver's
 *  `createDiscount` mints `amount: "10"` to match (that value is inlined there — the billing package
 *  cannot depend "up" on this service, ADR-0003). */
export const AFFILIATE_DISCOUNT_PCT = 10;

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * Integer commission for one order's charged amount (ADR-0007 integer money, ADR-0212 round-DOWN
 * ethos): `floor(amountCents * commissionBps / 10000)`. BigInt throughout — no float materializes;
 * BigInt division truncates toward zero and amounts are non-negative, so it IS floor. Rounding down
 * favors the house (never over-pays commission on a fractional cent). e.g. 8910¢ at 3000bps → 2673¢.
 */
function commissionFor(amountCents: number, commissionBps: number): number {
  return Number((BigInt(amountCents) * BigInt(commissionBps)) / 10_000n);
}

export const AFFILIATE_CODE_SCHEMA_SQL = `
CREATE TABLE affiliate_code (
  id text PRIMARY KEY,
  code text UNIQUE NOT NULL,
  discount_id text UNIQUE NOT NULL,
  affiliate_name text NOT NULL,
  commission_bps integer NOT NULL,
  discount_pct integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  CONSTRAINT affiliate_code_commission_bps CHECK (commission_bps > 0 AND commission_bps <= 10000),
  CONSTRAINT affiliate_code_discount_pct CHECK (discount_pct > 0 AND discount_pct < 100)
);
-- Role-gated like admin_action_log, but GUARDED for role absence: this DDL rides the platform
-- migration chain, which can run before the admin roles are provisioned on a fresh DB. On the live
-- DB (roles present) the grants apply here; on a fresh DB they are (re-)applied at admin DEPLOY.
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin_write') THEN
    GRANT INSERT ON affiliate_code TO admin_write;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin') THEN
    GRANT SELECT ON affiliate_code TO admin;
  END IF;
END $$;
`;

export interface InsertAffiliateCodeInput {
  /** The redeemable code Paddle minted (already validated + normalized by Paddle at mint time). */
  code: string;
  /** The Paddle discount id (`dsc_…`) — the UNIQUE join key. */
  discountId: string;
  /** The affiliate's display name. */
  affiliateName: string;
  /** The operator email that minted this code (audit provenance). */
  createdBy: string;
}

/**
 * Register a minted affiliate code (ADR-0315) — one row per Paddle discount. `commission_bps` and
 * `discount_pct` are the LOCKED program constants, never caller input. Runs as `admin_write`.
 */
export async function insertAffiliateCode(
  tx: TenantExecutor,
  input: InsertAffiliateCodeInput,
): Promise<void> {
  await tx.query(
    `INSERT INTO affiliate_code (id, code, discount_id, affiliate_name, commission_bps, discount_pct, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      randomUUID(),
      input.code,
      input.discountId,
      input.affiliateName,
      AFFILIATE_COMMISSION_BPS,
      AFFILIATE_DISCOUNT_PCT,
      input.createdBy,
    ],
  );
}

export interface AffiliateCodeRow {
  code: string;
  discountId: string;
  affiliateName: string;
  commissionBps: number;
  discountPct: number;
  createdAt: string;
  createdBy: string;
}

/** Every registered affiliate code, newest first — the cockpit's affiliate list. Runs as `admin`. */
export async function readAffiliateCodes(
  tx: TenantExecutor,
): Promise<AffiliateCodeRow[]> {
  const r = await tx.query<{
    code: string;
    discount_id: string;
    affiliate_name: string;
    commission_bps: number;
    discount_pct: number;
    created_at: unknown;
    created_by: string;
  }>(
    `SELECT code, discount_id, affiliate_name, commission_bps, discount_pct, created_at, created_by
       FROM affiliate_code
      ORDER BY created_at DESC`,
  );
  return r.rows.map((row) => ({
    code: row.code,
    discountId: row.discount_id,
    affiliateName: row.affiliate_name,
    commissionBps: row.commission_bps,
    discountPct: row.discount_pct,
    createdAt: toIso(row.created_at),
    createdBy: row.created_by,
  }));
}

/** One attributed order line in the commission report. */
export interface AffiliateReportOrder {
  /** `order_record.source_event_id` — the payment/invoice id. */
  orderId: string;
  accountId: string;
  /** Charged (post-discount) minor units — the commission base (ADR-0007 integer). */
  amountCents: number;
  currency: string;
  status: "paid" | "refunded";
  createdAt: string;
  /** ALERT-ONLY flag (ADR-0294/0302): true = this order was refunded, so its commission is a
   *  clawback the operator reviews — the report FLAGS, it never moves money. */
  clawback: boolean;
  /** ALERT-ONLY flag (SHIP-audit): the order still reads 'paid' but at least one of its line
   *  grants has been REVOKED — a per-line (dollar/item) refund or an admin revoke. Its commission
   *  stays in the payable sum (the report never moves money), flagged so the operator reviews the
   *  order before paying out. Whole-order refunds flip `status` instead and never set this. */
  partialRefund: boolean;
}

/** One affiliate's rollup in the commission report. */
export interface AffiliateReportEntry {
  affiliateName: string;
  code: string;
  discountId: string;
  commissionBps: number;
  discountPct: number;
  /** Every attributed order (paid + refunded), newest first. */
  orders: AffiliateReportOrder[];
  /** Sum of PAID (non-refunded) order amounts — the net revenue commission is owed on. */
  grossCents: number;
  /** Commission PAYABLE this period: `floor(amount * bps / 10000)` summed over PAID orders only. */
  commissionCents: number;
  /** The clawback ALERT amount: the same commission math summed over REFUNDED orders — surfaced so
   *  the operator can manually net a prior period's payout. Never auto-deducted. */
  clawbackCents: number;
}

export interface AffiliateReport {
  affiliates: AffiliateReportEntry[];
  /** Orders that carried a `discount_id` matching NO registered affiliate_code (a manually-created
   *  Paddle discount, or a code deleted from the registry) — shown honestly, never silently dropped. */
  unattributed: AffiliateReportOrder[];
}

/**
 * The commission report (ADR-0315): joins every attributed `order_record` (discount_id set) to its
 * `affiliate_code`, groups per affiliate, and computes payable commission + a refund clawback alert.
 * CROSS-TENANT — reads every tenant's orders — so the caller runs it as the read-only `admin` role
 * (withAdminRead; needs a cross-tenant read policy on `order_record`). Integer money throughout.
 */
export async function readAffiliateReport(
  tx: TenantExecutor,
): Promise<AffiliateReport> {
  const r = await tx.query<{
    source_event_id: string;
    account_id: string;
    amount: number;
    currency: string;
    status: "paid" | "refunded";
    created_at: unknown;
    discount_id: string;
    affiliate_name: string | null;
    code: string | null;
    commission_bps: number | null;
    discount_pct: number | null;
    partial_refund: boolean;
  }>(
    // partial_refund (SHIP-audit): a per-line refund revokes that line's grants but leaves the
    // order 'paid' (only a WHOLE-transaction refund flips status), so without this flag the
    // report would show full payable commission on a partially — or, when credits were already
    // spent, even fully — refunded order with zero signal. Any revoked one-time grant backed by
    // this purchase marks the row for operator review; kind='purchase' only (subscription
    // invoice refunds flip status on the whole-transaction path).
    `SELECT o.source_event_id, o.account_id, o.amount, o.currency, o.status, o.created_at,
            o.discount_id, a.affiliate_name, a.code, a.commission_bps, a.discount_pct,
            (o.kind = 'purchase' AND o.status = 'paid' AND EXISTS (
              SELECT 1 FROM entitlement_grant g
               WHERE g.account_id = o.account_id
                 AND g.source_kind = 'one_time'
                 AND g.purchase_id = o.source_event_id
                 AND g.status = 'revoked')) AS partial_refund
       FROM order_record o
       LEFT JOIN affiliate_code a ON a.discount_id = o.discount_id
      WHERE o.discount_id IS NOT NULL
      ORDER BY o.created_at DESC`,
  );

  const byDiscount = new Map<string, AffiliateReportEntry>();
  const unattributed: AffiliateReportOrder[] = [];

  for (const row of r.rows) {
    const order: AffiliateReportOrder = {
      orderId: row.source_event_id,
      accountId: row.account_id,
      amountCents: row.amount,
      currency: row.currency,
      status: row.status,
      createdAt: toIso(row.created_at),
      clawback: row.status === "refunded",
      partialRefund: row.partial_refund,
    };
    // A discount id with no matching affiliate_code row (LEFT JOIN → null) — honest display, not a drop.
    if (row.affiliate_name === null || row.commission_bps === null) {
      unattributed.push(order);
      continue;
    }
    let entry = byDiscount.get(row.discount_id);
    if (entry === undefined) {
      entry = {
        affiliateName: row.affiliate_name,
        code: row.code ?? "",
        discountId: row.discount_id,
        commissionBps: row.commission_bps,
        discountPct: row.discount_pct ?? AFFILIATE_DISCOUNT_PCT,
        orders: [],
        grossCents: 0,
        commissionCents: 0,
        clawbackCents: 0,
      };
      byDiscount.set(row.discount_id, entry);
    }
    entry.orders.push(order);
    const commission = commissionFor(order.amountCents, entry.commissionBps);
    if (order.status === "refunded") {
      entry.clawbackCents += commission; // alert-only: a refunded sale's commission
    } else {
      entry.grossCents += order.amountCents;
      entry.commissionCents += commission;
    }
  }

  return { affiliates: [...byDiscount.values()], unattributed };
}

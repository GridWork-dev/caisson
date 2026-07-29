// The ADR-0089 cycle->grant mapper, end to end on PGlite + real withTenant (ADR-0005 RLS). Asserts the
// binding test list: invoice.paid(create|cycle) grants once; a retry on the SAME invoice id is
// idempotent (one row); two invoice ids grant twice; subscription.* lifecycle events grant nothing;
// proration (subscription_update) grants nothing; an unknown price id fails closed (throws, no row);
// cancel never claws back. Each test uses its own account id so no cross-test cleanup is needed.
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
// PGlite under CI runner load regularly crosses the 5s default; repo-wide standard treatment.
setDefaultTimeout(30_000);
import { ConfigError, asCredits } from "@caisson/kernel";
import { LEGACY_ENTITLEMENT_ALIASES } from "@caisson/registry-schema";
import { type TestPg, newTestPg } from "@caisson/testing";

/**
 * Run `body` with a temporary MODULE-RENAME alias installed in the shared spine (ADR-0270 narrowed the
 * production spine to empty; the renewal read-back fold must survive for the NEXT rename). Injects
 * `old → current`, then restores — the surviving-alias stand-in the dissolved edition ids used to be.
 */
async function withRenameAlias(
  old: string,
  current: string,
  body: () => Promise<void>,
): Promise<void> {
  const spine = LEGACY_ENTITLEMENT_ALIASES as Map<string, string>;
  spine.set(old, current);
  try {
    await body();
  } finally {
    spine.delete(old);
  }
}
import {
  CREDIT_LINE_ITEM_MIGRATION_SQL,
  CREDIT_EXPIRY_MIGRATION_SQL,
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
  GRANT_CONSUMPTION_MIGRATION_SQL,
  balance,
  debit,
  getLedger,
} from "@caisson/credits";
import { withAdvisoryXactLock } from "@caisson/jobs";
import { withTenant, type TenantExecutor } from "@caisson/tenancy-rls";
import type { DomainBillingEvent } from "@caisson/billing";
import {
  parseStripeEvent,
  PROCESSED_EVENT_SCHEMA_SQL,
} from "@caisson/billing-orchestration";
import { applyBillingEvent } from "./apply-billing-event.ts";
import {
  computeUpdatesWindows,
  ENTITLEMENT_GRANT_CHARGED_AMOUNT_MIGRATION_SQL,
  ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL,
  ENTITLEMENT_GRANT_REFUNDED_AMOUNT_MIGRATION_SQL,
  ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL,
  RENEWAL_EXTENSION_MONTHS_MIGRATION_SQL,
  RENEWAL_EXTENSION_SCHEMA_SQL,
  ENTITLEMENT_SCHEMA_SQL,
  grantEntitlements,
  netCharged,
  readEntitlements,
} from "./entitlement-store.ts";
import {
  ORDER_RECORD_SCHEMA_SQL,
  ORDER_RECORD_SUBSCRIPTION_LINK_MIGRATION_SQL,
  ORDER_RECORD_DISCOUNT_MIGRATION_SQL,
  readOrderRecords,
  readSubscriptionStatuses,
  SUBSCRIPTION_STATUS_SCHEMA_SQL,
} from "./subscription-history-store.ts";
import {
  AFFILIATE_CODE_SCHEMA_SQL,
  readAffiliateReport,
  insertAffiliateCode,
} from "./affiliate-store.ts";

const PLAN_ID = "price_developer_monthly_PLACEHOLDER"; // 1000 credits/cycle, entitlements [] (placeholder)
const CREDITS = 1000;
// An edition plan (12000 credits/cycle) that ALSO grants the `compliance` entitlement (ADR-0071).
const EDITION_PLAN_ID = "price_compliance_updates_annual_PLACEHOLDER";
// One-time PURCHASE_BOOK placeholders (ADR-0113): a 5000-credit pack (no entitlement) + a license-only
// compliance buy (0 credits, grants the `compliance` entitlement).
const CREDIT_PACK_ID = "price_credit_pack_PLACEHOLDER";
const PACK_CREDITS = 5000;
const ONETIME_EDITION_ID = "price_compliance_onetime_PLACEHOLDER";

function purchaseCompleted(
  accountId: string,
  paymentId: string,
  priceId: string,
  eventId?: string,
): DomainBillingEvent {
  return {
    type: "purchase.completed",
    sourceEventId: eventId ?? `evt_${paymentId}`,
    accountId,
    amountTotal: 499900,
    currency: "usd",
    lineItems: [{ priceId, quantity: 1, itemId: "", chargedAmount: 0 }],
    paymentId,
  };
}

type CartLine = {
  priceId: string;
  quantity: number;
  itemId?: string;
  chargedAmount?: number;
};

/** A multi-line one-time purchase (a cart, Strix vuln-0005) — one grant per paid line. `itemId` +
 * `chargedAmount` default to the empty sentinels so pre-0218 callers are unchanged; a per-line refund
 * test passes real `txnitm_` ids + charged amounts. */
function purchaseCompletedMulti(
  accountId: string,
  paymentId: string,
  lineItems: CartLine[],
): DomainBillingEvent {
  return {
    type: "purchase.completed",
    sourceEventId: `evt_${paymentId}`,
    accountId,
    amountTotal: 499900,
    currency: "usd",
    lineItems: lineItems.map((l) => ({
      priceId: l.priceId,
      quantity: l.quantity,
      itemId: l.itemId ?? "",
      chargedAmount: l.chargedAmount ?? 0,
    })),
    paymentId,
  };
}

function refundCompleted(
  accountId: string,
  paymentId: string,
  fullyRefunded = true,
): DomainBillingEvent {
  return {
    type: "refund.completed",
    sourceEventId: `evt_refund_${paymentId}`,
    accountId,
    paymentId,
    amountRefunded: 499900,
    currency: "usd",
    fullyRefunded,
    adjustmentId: "",
    items: [],
  };
}

/** A per-line partial adjustment refund (ADR-0218): whole-transaction `fullyRefunded:false`, acting
 * per `items[]`. `adjustmentId` is the per-line clawback idempotency anchor. */
function refundPerLine(
  accountId: string,
  paymentId: string,
  adjustmentId: string,
  items: { itemId: string; amountRefunded: number; fullyRefunded: boolean }[],
): DomainBillingEvent {
  return {
    type: "refund.completed",
    sourceEventId: `evt_refund_${adjustmentId}`,
    accountId,
    paymentId,
    amountRefunded: items.reduce((s, i) => s + i.amountRefunded, 0),
    currency: "usd",
    fullyRefunded: false,
    adjustmentId,
    items,
  };
}

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(CREDIT_SCHEMA_SQL);
  await tp.exec(CREDIT_ROUNDING_MIGRATION_SQL);
  await tp.exec(CREDIT_LINE_ITEM_MIGRATION_SQL);
  await tp.exec(CREDIT_EXPIRY_MIGRATION_SQL);
  await tp.exec(GRANT_CONSUMPTION_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_SCHEMA_SQL);
  await tp.exec(ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_GRANT_CHARGED_AMOUNT_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_GRANT_REFUNDED_AMOUNT_MIGRATION_SQL);
  await tp.exec(RENEWAL_EXTENSION_SCHEMA_SQL);
  await tp.exec(RENEWAL_EXTENSION_MONTHS_MIGRATION_SQL);
  // G7 (audit 2026-07-07): invoice.paid/purchase.completed now gate their grant + returned effect
  // behind withIdempotentSideEffect's claim table.
  await tp.exec(PROCESSED_EVENT_SCHEMA_SQL);
  await tp.exec(SUBSCRIPTION_STATUS_SCHEMA_SQL);
  await tp.exec(ORDER_RECORD_SCHEMA_SQL);
  await tp.exec(ORDER_RECORD_SUBSCRIPTION_LINK_MIGRATION_SQL);
  // ADR-0315: the affiliate-attribution column on order_record + the affiliate_code registry.
  await tp.exec(ORDER_RECORD_DISCOUNT_MIGRATION_SQL);
  await tp.exec(AFFILIATE_CODE_SCHEMA_SQL);
});

afterAll(async () => {
  await tp.close();
});

function invoicePaid(
  accountId: string,
  invoiceId: string,
  opts: {
    billingReason?: string;
    priceId?: string;
    eventId?: string;
    amountTotal?: number;
    subscriptionId?: string;
  } = {},
): DomainBillingEvent {
  return {
    type: "invoice.paid",
    sourceEventId: opts.eventId ?? `evt_${invoiceId}`,
    accountId,
    amountTotal: opts.amountTotal ?? 9900,
    currency: "usd",
    subscriptionId: opts.subscriptionId ?? "sub_1",
    priceId: opts.priceId ?? PLAN_ID,
    billingReason: opts.billingReason ?? "subscription_cycle",
    invoiceId,
  };
}

function subscriptionCanceled(
  accountId: string,
  subscriptionId: string,
): DomainBillingEvent {
  return {
    type: "subscription.canceled",
    sourceEventId: `evt_cancel_${subscriptionId}`,
    accountId,
    subscriptionId,
  };
}

describe("applyBillingEvent — subscription cycle -> grant (ADR-0089)", () => {
  test("invoice.paid(subscription_create) grants the cycle allotment once", async () => {
    const acct = "acct_create";
    const bal = await withTenant(tp.pg, acct, async (tx) => {
      await applyBillingEvent(
        tx,
        invoicePaid(acct, "in_1", { billingReason: "subscription_create" }),
      );
      return balance(tx, acct);
    });
    expect(bal).toBe(CREDITS);
    const ledger = await withTenant(tp.pg, acct, (tx) => getLedger(tx, acct));
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.event_type).toBe("sub_allotment");
    expect(ledger[0]?.amount).toBe(CREDITS);
    expect(ledger[0]?.source_event_id).toBe("in_1");
    // ADR-0212/ADR-0089 §5: the cycle grant is the EXACT plan-table integer — no rounding site in
    // the path, so the row correctly persists NULL/NULL provenance.
    const prov = await tp.query<{
      rounding_raw: number | null;
      rounding_mode: string | null;
    }>(
      `SELECT rounding_raw, rounding_mode FROM credit_event WHERE account_id = $1`,
      [acct],
    );
    expect(prov).toEqual([{ rounding_raw: null, rounding_mode: null }]);
  });

  test("a webhook retry on the same invoice id is idempotent — one row", async () => {
    const acct = "acct_retry";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, invoicePaid(acct, "in_r", { eventId: "evt_a" })),
    );
    // Same invoice id, FRESH event id (a manual resend) — must still be one allotment (ADR-0089 §4).
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, invoicePaid(acct, "in_r", { eventId: "evt_b" })),
    );
    const ledger = await withTenant(tp.pg, acct, (tx) => getLedger(tx, acct));
    expect(ledger).toHaveLength(1);
    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(CREDITS);
  });

  test("G7 (audit 2026-07-07): a resend's RETURNED EFFECT is empty, not just the DB row count", async () => {
    // The gap the audit named: applyBillingEvent used to rebuild grantedEntitlements/skuLines from
    // the INPUT event on every call, even when the DB write was a no-op replay — so app.ts's
    // Discord/PostHog/purchase-email pushes re-fired on a Paddle "Resend" (fresh event_id, same
    // invoice). Pin the FIX at the source: the second call's returned effect must be empty.
    const acct = "acct_g7_invoice";
    const first = await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "in_g7", { eventId: "evt_g7_a" }),
      ),
    );
    expect(first.grantedEntitlements).toEqual([]); // credits-only PLAN_ID grants no entitlement…
    expect(first.skuLines.length).toBe(1); // …but the SKU line always attributes the charge.

    const resend = await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "in_g7", { eventId: "evt_g7_b" }),
      ),
    );
    expect(resend).toEqual({
      grantedEntitlements: [],
      skuLines: [],
      renewedEntitlements: [],
      chargebackAlerts: [],
      revokeNotices: [],
    });
    // The DB write is ALSO skipped on the resend (not merely re-applied idempotently) — one row.
    const ledger = await withTenant(tp.pg, acct, (tx) => getLedger(tx, acct));
    expect(ledger).toHaveLength(1);
  });

  test("G7: a one-time purchase resend's RETURNED EFFECT is empty too", async () => {
    const acct = "acct_g7_purchase";
    const first = await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompleted(acct, "pi_g7", ONETIME_EDITION_ID, "evt_g7_pur_a"),
      ),
    );
    expect(first.grantedEntitlements).toEqual(["compliance"]);

    const resend = await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompleted(acct, "pi_g7", ONETIME_EDITION_ID, "evt_g7_pur_b"),
      ),
    );
    expect(resend).toEqual({
      grantedEntitlements: [],
      skuLines: [],
      renewedEntitlements: [],
      chargebackAlerts: [],
      revokeNotices: [],
    });
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]); // still granted exactly once, not un-granted
  });

  test("two distinct invoices grant twice (2 x creditsPerCycle)", async () => {
    const acct = "acct_two";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, invoicePaid(acct, "in_a")),
    );
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, invoicePaid(acct, "in_b")),
    );
    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(2 * CREDITS);
  });

  test("subscription.created grants nothing (the X-2 trap stays closed)", async () => {
    const acct = "acct_sigcreate";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, {
        type: "subscription.created",
        sourceEventId: "evt_s",
        accountId: acct,
      }),
    );
    const ledger = await withTenant(tp.pg, acct, (tx) => getLedger(tx, acct));
    expect(ledger).toHaveLength(0);
  });

  test("invoice.paid(subscription_update) proration grants nothing (default SD-1)", async () => {
    const acct = "acct_upd";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "in_u", { billingReason: "subscription_update" }),
      ),
    );
    const ledger = await withTenant(tp.pg, acct, (tx) => getLedger(tx, acct));
    expect(ledger).toHaveLength(0);
  });

  test("subscription.canceled never claws back credits (only entitlements revoke, ADR-0113)", async () => {
    const acct = "acct_cancel";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, invoicePaid(acct, "in_c")),
    );
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, {
        type: "subscription.canceled",
        sourceEventId: "evt_x",
        accountId: acct,
        subscriptionId: "sub_1",
      }),
    );
    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(CREDITS); // credits are append-only / no-clawback on cancel
  });

  test("an unknown price id fails closed — throws, writes nothing", async () => {
    const acct = "acct_unknown";
    await expect(
      withTenant(tp.pg, acct, (tx) =>
        applyBillingEvent(
          tx,
          invoicePaid(acct, "in_x", { priceId: "price_not_in_book" }),
        ),
      ),
    ).rejects.toThrow(ConfigError);
    const ledger = await withTenant(tp.pg, acct, (tx) => getLedger(tx, acct));
    expect(ledger).toHaveLength(0);
  });

  test("a REAL Stripe invoice.paid parsed end-to-end moves the wallet (round-trip, no top-level metadata)", async () => {
    // The W2 mitigation: drive the WRITER (parseStripeEvent) into the READER (applyBillingEvent) so the
    // value-contract is pinned across the seam, not just on each side. A realistic cycle invoice carries
    // the account on subscription_details.metadata, NOT top-level metadata (Stripe never copies session
    // metadata onto invoices) — this test fails if readAccountId stops reading subscription_details.
    const acct = "acct_roundtrip";
    const raw = {
      id: "evt_rt",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_rt",
          amount_paid: 9900,
          currency: "usd",
          subscription: "sub_rt",
          billing_reason: "subscription_cycle",
          subscription_details: { metadata: { account_id: acct } },
          lines: { data: [{ price: { id: PLAN_ID } }] },
        },
      },
    } as Parameters<typeof parseStripeEvent>[0];
    const ev = parseStripeEvent(raw);
    expect(ev?.accountId).toBe(acct); // the recurring-grant account actually resolves
    const bal = await withTenant(tp.pg, acct, async (tx) => {
      await applyBillingEvent(tx, ev as DomainBillingEvent);
      return balance(tx, acct);
    });
    expect(bal).toBe(CREDITS);
    const ledger = await withTenant(tp.pg, acct, (tx) => getLedger(tx, acct));
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.source_event_id).toBe("in_rt");
  });

  test("an unknown one-time price id fails closed — throws, writes nothing", async () => {
    const acct = "acct_purchase_unknown";
    await expect(
      withTenant(tp.pg, acct, (tx) =>
        applyBillingEvent(
          tx,
          purchaseCompleted(acct, "pi_unknown", "price_not_in_book"),
        ),
      ),
    ).rejects.toThrow(ConfigError);
    const ledger = await withTenant(tp.pg, acct, (tx) => getLedger(tx, acct));
    expect(ledger).toHaveLength(0);
  });

  test("purchase.completed with no payment id fails closed (cannot anchor a refund)", async () => {
    const acct = "acct_purchase_nopid";
    await expect(
      withTenant(tp.pg, acct, (tx) =>
        applyBillingEvent(tx, purchaseCompleted(acct, "", CREDIT_PACK_ID)),
      ),
    ).rejects.toThrow(ConfigError);
  });
});

describe("applyBillingEvent — chargeback: ALERT-ONLY, no grant/revoke/claw (ADR-0294)", () => {
  test("a chargeback surfaces chargebackAlerts and touches NO grant/credit/entitlement table", async () => {
    const acct = "acct_chargeback";
    const effect = await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, {
        type: "chargeback.detected",
        sourceEventId: "evt_cb_1",
        accountId: acct,
        paymentId: "txn_disputed",
        amountDisputed: 74900,
        currency: "usd",
      }),
    );
    expect(effect).toEqual({
      grantedEntitlements: [],
      skuLines: [],
      renewedEntitlements: [],
      chargebackAlerts: [
        {
          accountId: acct,
          paymentId: "txn_disputed",
          amountDisputed: 74900,
          currency: "usd",
        },
      ],
      revokeNotices: [],
    });
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual([]);
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(0);
  });

  test("a chargeback on an account with an ACTIVE purchase leaves it fully intact", async () => {
    // The whole point of ALERT-ONLY: a disputed charge must not silently strip access the
    // operator has not yet reviewed.
    const acct = "acct_chargeback_active";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompleted(acct, "pi_cb_active", ONETIME_EDITION_ID),
      ),
    );
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, {
        type: "chargeback.detected",
        sourceEventId: "evt_cb_2",
        accountId: acct,
        paymentId: "pi_cb_active",
        amountDisputed: 74900,
        currency: "usd",
      }),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]); // untouched — the operator decides, not this mapper
  });

  test("WR-01 (SHIP review 2026-07-08): a Resend (fresh event_id, same disputed transaction) alerts only ONCE", async () => {
    // The same gap G7 closed for grants: a Paddle dashboard Resend mints a FRESH event_id for the
    // SAME underlying dispute, so the outer processEvent claim (keyed on event_id) alone would let
    // it through as if new. The chargeback branch's own withIdempotentSideEffect, keyed on the
    // stable disputed transaction id, must catch what the outer claim cannot.
    const acct = "acct_cb_resend";
    const first = await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, {
        type: "chargeback.detected",
        sourceEventId: "evt_cb_resend_a",
        accountId: acct,
        paymentId: "txn_cb_resend",
        amountDisputed: 74900,
        currency: "usd",
      }),
    );
    expect(first.chargebackAlerts.length).toBe(1);

    const resend = await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, {
        type: "chargeback.detected",
        sourceEventId: "evt_cb_resend_b", // fresh delivery id, same dispute
        accountId: acct,
        paymentId: "txn_cb_resend", // same disputed transaction
        amountDisputed: 74900,
        currency: "usd",
      }),
    );
    expect(resend.chargebackAlerts).toEqual([]);
  });

  test("a chargeback with no transaction id falls back to sourceEventId as the idempotency key", async () => {
    const acct = "acct_cb_notxn";
    const effect = await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, {
        type: "chargeback.detected",
        sourceEventId: "evt_cb_notxn",
        accountId: acct,
        paymentId: "", // missing on the delivery — parsePaddleEvent's "" sentinel
        amountDisputed: 5000,
        currency: "usd",
      }),
    );
    expect(effect.chargebackAlerts.length).toBe(1);
    // A true redelivery (SAME event_id) never even reaches applyBillingEvent again (the outer
    // processEvent claim in webhook.ts absorbs it) — pin only that the fallback key is non-empty
    // and usable, not a second call with the identical sourceEventId (assertValidSourceEventId
    // would reject an empty key outright, which this proves it never is).
  });
});

describe("applyBillingEvent — one-time purchase grant (ADR-0113)", () => {
  test("a one-time credit pack grants credits keyed on the payment id (no entitlement)", async () => {
    const acct = "acct_pack";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, purchaseCompleted(acct, "pi_pack", CREDIT_PACK_ID)),
    );
    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(PACK_CREDITS);
    const ledger = await withTenant(tp.pg, acct, (tx) => getLedger(tx, acct));
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.event_type).toBe("purchase");
    expect(ledger[0]?.source_event_id).toBe("pi_pack"); // refund looks up the grant by this id
    const ents = await withTenant(tp.pg, acct, (tx) =>
      readEntitlements(tx, acct),
    );
    expect(ents).toEqual([]);
  });

  test("a one-time edition buy grants the entitlement (license-only, no credit pack)", async () => {
    const acct = "acct_onetime_ed";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompleted(acct, "pi_ed", ONETIME_EDITION_ID),
      ),
    );
    const ents = await withTenant(tp.pg, acct, (tx) =>
      readEntitlements(tx, acct),
    );
    expect(ents).toEqual(["compliance"]);
    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(0); // 0-credit license-only buy grants no credits
  });

  test("a multi-item cart grants EVERY line: edition entitlement AND pack credits (Strix vuln-0005)", async () => {
    // The pre-fix mapper fulfilled only items[0]: a cart of {compliance edition, credit pack} granted
    // just ["compliance"] and 0 credits. One applyBillingEvent must now land BOTH the entitlement and
    // the pack's credits from the single transaction.
    const acct = "acct_cart";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompletedMulti(acct, "pi_cart", [
          { priceId: ONETIME_EDITION_ID, quantity: 1 },
          { priceId: CREDIT_PACK_ID, quantity: 1 },
        ]),
      ),
    );
    const ents = await withTenant(tp.pg, acct, (tx) =>
      readEntitlements(tx, acct),
    );
    expect(ents).toEqual(["compliance"]);
    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(PACK_CREDITS); // the pack line's credits landed, not just the first line
  });

  test("a quantity>1 line multiplies the credits granted (Strix vuln-0005)", async () => {
    // A buyer who bumps a credit-pack line to quantity 3 pays 3× and must be granted 3× the credits.
    const acct = "acct_cart_qty";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompletedMulti(acct, "pi_cart_qty", [
          { priceId: CREDIT_PACK_ID, quantity: 3 },
        ]),
      ),
    );
    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(PACK_CREDITS * 3);
  });

  test("a one-time grant SURVIVES a subscription cancel for the same edition (refcount)", async () => {
    const acct = "acct_survive";
    // Subscription grants compliance...
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "in_s1", { priceId: EDITION_PLAN_ID }),
      ),
    );
    // ...and a one-time buy ALSO grants compliance.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompleted(acct, "pi_s1", ONETIME_EDITION_ID),
      ),
    );
    // Cancel the subscription (sub_1, from invoicePaid's fixture).
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, {
        type: "subscription.canceled",
        sourceEventId: "evt_cancel",
        accountId: acct,
        subscriptionId: "sub_1",
      }),
    );
    const ents = await withTenant(tp.pg, acct, (tx) =>
      readEntitlements(tx, acct),
    );
    expect(ents).toEqual(["compliance"]); // the one-time grant keeps it alive
  });

  test("subscription.canceled revokes the subscription's entitlement (no other source)", async () => {
    const acct = "acct_revoke_only";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "in_r1", { priceId: EDITION_PLAN_ID }),
      ),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]);
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, {
        type: "subscription.canceled",
        sourceEventId: "evt_c2",
        accountId: acct,
        subscriptionId: "sub_1",
      }),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual([]); // gone — refcount 0
  });

  // CAISSON-25 "static-entitlement ordering race": a delayed invoice.paid processed AFTER
  // subscription.canceled must not leave a plan's fixed grant row that no later event can revoke.
  // `upsertSubscriptionGrants` (entitlement-store.ts) closes the RENEWAL-CYCLE variant of this race
  // via its `ON CONFLICT ... DO UPDATE ... WHERE entitlement_grant.status = 'active'` guard: once a
  // row exists and is revoked, the unique-index conflict on a later grant attempt hits that WHERE
  // guard and updates 0 rows — the row is never resurrected (verified 2026-07-06, predates this
  // ticket). This pins that guard against the EXACT out-of-order-delivery shape CAISSON-25 names.
  //
  // The FIRST-CYCLE variant this comment once tracked as an open residual (a subscription's
  // FIRST-EVER invoice.paid delayed past an immediate cancel — no pre-existing grant row for the
  // guard above to catch) was CLOSED by Kickoff-H W3 (ADR-0302, migration 0023):
  // `cancelSubscriptionStatus` (subscription-history-store.ts) writes a 'canceled'
  // subscription_status tombstone even when no grant rows exist yet, and invoice.paid's grant-time
  // liveness check (`readSubscriptionStatus` in apply-billing-event.ts) refuses entitlement +
  // coverage-mirror grants for a canceled subscription — credits still grant (a bounded, paid-for
  // allotment, clawed by a refund of the same invoice). Both fork shapes the Linear ticket left
  // open shipped as that one mechanism. The only CAISSON-25 residual is the operator
  // launch-runbook check that Paddle dunning CANCELS (never pauses) after the final retry — a
  // pause emits no subscription.canceled at all (docs/state/production-readiness.md).
  test("CAISSON-25: a late (out-of-order) renewal-cycle invoice.paid for an ALREADY-canceled subscription never resurrects the revoked entitlement", async () => {
    const acct = "acct_late_invoice_after_cancel";
    // Cycle 1 grants the plan's entitlement under subscription "sub_1" (the invoicePaid() fixture).
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "in_c1", { priceId: EDITION_PLAN_ID }),
      ),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]);

    // subscription.canceled processes NEXT — the row flips to revoked.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, {
        type: "subscription.canceled",
        sourceEventId: "evt_late_cancel",
        accountId: acct,
        subscriptionId: "sub_1",
      }),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual([]);

    // A DELAYED cycle-2 invoice.paid for the SAME subscription arrives AFTER the cancel already
    // committed — models out-of-order webhook delivery (a retry/backlog), never a legitimate
    // resubscribe (which always mints a fresh subscription id at Paddle).
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "in_c2", { priceId: EDITION_PLAN_ID }),
      ),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual([]); // still gone — the late grant attempt resurrected nothing
    const rows = await tp.query<{ status: string }>(
      `SELECT status FROM entitlement_grant WHERE account_id = $1 AND subscription_id = 'sub_1'`,
      [acct],
    );
    expect(rows).toEqual([{ status: "revoked" }]); // one row total — never a fresh active insert either
  });
});

describe("applyBillingEvent — refund: revoke + claw unspent credits (ADR-0113)", () => {
  test("refund soft-revokes the purchase's entitlement AND claws back the full unspent grant", async () => {
    const acct = "acct_refund_full";
    // One multi-line cart (a real Paddle transaction carries every line in ONE event — G7, 2026-07-07):
    // a credit pack + a one-time edition so the refund has both credits to claw and an entitlement
    // to revoke, all under the SAME payment id.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompletedMulti(acct, "pi_rf", [
          { priceId: CREDIT_PACK_ID, quantity: 1 },
          { priceId: ONETIME_EDITION_ID, quantity: 1 },
        ]),
      ),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]);
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, refundCompleted(acct, "pi_rf")),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual([]); // entitlement revoked
    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(0); // full 5000 clawed back (nothing spent)
  });

  test("a spent-down wallet claws back ONLY the remainder (never negative)", async () => {
    const acct = "acct_refund_spent";
    // One multi-line cart: the edition (0 credits) + a credit pack, so there are credits to spend + claw.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompletedMulti(acct, "pi_sp", [
          { priceId: ONETIME_EDITION_ID, quantity: 1 },
          { priceId: CREDIT_PACK_ID, quantity: 1 },
        ]),
      ),
    );
    // Spend 4000 of the 5000.
    await withTenant(tp.pg, acct, (tx) =>
      debit(tx, {
        eventType: "codegen_debit",
        accountId: acct,
        amount: asCredits(4000),
        idempotencyKey: "spend_sp",
      }),
    );
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, refundCompleted(acct, "pi_sp")),
    );
    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(0); // only the unspent 1000 clawed; never negative
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual([]);
  });

  test("a fully-spent wallet claws back nothing (no debit row, never negative)", async () => {
    const acct = "acct_refund_zero";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, purchaseCompleted(acct, "pi_z", CREDIT_PACK_ID)),
    );
    await withTenant(tp.pg, acct, (tx) =>
      debit(tx, {
        eventType: "codegen_debit",
        accountId: acct,
        amount: asCredits(PACK_CREDITS),
        idempotencyKey: "spend_z",
      }),
    );
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, refundCompleted(acct, "pi_z")),
    );
    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(0);
    const ledger = await withTenant(tp.pg, acct, (tx) => getLedger(tx, acct));
    // purchase + spend only — NO refund_clawback row (a zero debit would violate amount<>0).
    // Sorted: getLedger tiebreaks same-timestamp rows by random UUID, so insertion order is not
    // observable when both rows land in the same ms (seen on loaded CI runners).
    expect(ledger.map((e) => e.event_type).sort()).toEqual([
      "codegen_debit",
      "purchase",
    ]);
  });

  test("a re-delivered refund does not double-revoke or double-claw (idempotent)", async () => {
    const acct = "acct_refund_idem";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, purchaseCompleted(acct, "pi_id", CREDIT_PACK_ID)),
    );
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompleted(acct, "pi_id", ONETIME_EDITION_ID),
      ),
    );
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, refundCompleted(acct, "pi_id")),
    );
    // Buyer buys a fresh credit pack AFTER the refund (a different payment).
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, purchaseCompleted(acct, "pi_new", CREDIT_PACK_ID)),
    );
    // A stale re-delivery of the SAME refund must do nothing: the revoke is a no-op (no active grant
    // left) AND the clawback dedups on its (paymentId, refund_clawback) unique key — no second debit.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, refundCompleted(acct, "pi_id")),
    );
    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(PACK_CREDITS); // only the post-refund pack survives; no second clawback
  });

  test("a PARTIAL refund (fullyRefunded=false) is a no-op — no revoke, no clawback (ADR-0113 W1)", async () => {
    const acct = "acct_refund_partial";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompletedMulti(acct, "pi_pt", [
          { priceId: CREDIT_PACK_ID, quantity: 1 },
          { priceId: ONETIME_EDITION_ID, quantity: 1 },
        ]),
      ),
    );
    // A partial charge.refunded must NOT strip access or claw the whole grant.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, refundCompleted(acct, "pi_pt", false)),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]); // still entitled
    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(PACK_CREDITS); // nothing clawed
  });

  test("a credits-only pack refund claws back the unspent credits (no entitlement to revoke)", async () => {
    // The clawback fires on the granted-credits lookup, NOT the entitlement-revoke count — so a pure
    // credit-pack refund (entitlements: []) still reclaims the unspent credits (ADR-0113 N1).
    const acct = "acct_refund_pack_only";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, purchaseCompleted(acct, "pi_pk", CREDIT_PACK_ID)),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual([]); // a credit pack grants no entitlement
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, refundCompleted(acct, "pi_pk")),
    );
    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(0); // the full 5000 unspent pack clawed back
  });

  test("a refund round-trips from a parsed charge.refunded (W2/B1 seam)", async () => {
    const acct = "acct_refund_rt";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, purchaseCompleted(acct, "pi_rt", CREDIT_PACK_ID)),
    );
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompleted(acct, "pi_rt", ONETIME_EDITION_ID),
      ),
    );
    const raw = {
      id: "evt_refund_rt",
      type: "charge.refunded",
      data: {
        object: {
          payment_intent: "pi_rt",
          amount_refunded: 499900,
          currency: "usd",
          refunded: true, // a FULL refund — the mapper acts (a partial leaves this false)
          // Stripe copies the PaymentIntent metadata (stamped at checkout) onto the Charge.
          metadata: { account_id: acct },
        },
      },
    } as Parameters<typeof parseStripeEvent>[0];
    const ev = parseStripeEvent(raw);
    expect(ev?.type).toBe("refund.completed");
    if (ev?.type === "refund.completed") {
      expect(ev.paymentId).toBe("pi_rt"); // the join key actually resolves
    }
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, ev as DomainBillingEvent),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual([]);
    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(0);
  });

  // CAISSON-25b (ADR-0269 §6 accepted residual): this test pins the boundary the code DOES
  // enforce — a ONE-TIME purchase's refund claw is bounded to exactly what THAT purchase granted
  // and never reaches a sibling SUBSCRIPTION grant's credits or entitlement for the same account,
  // even when both back the SAME entitlement id (refcount).
  //
  // A refund of the SUBSCRIPTION payment itself is NOT a credits no-op (security-audit
  // correction, 2026-07-07 — the earlier claim here that "a subscription invoice's payment id was
  // never used as either key" was false): Paddle keys a cycle's sub_allotment grant by the
  // transaction id (`invoiceId: txnId` in paddle-events), the SAME id a refund adjustment
  // delivers as `paymentId`. The claw path therefore matches the cycle's own grant and claws its
  // UNSPENT remainder — bounded to that grant, never a sibling's — while the entitlement survives
  // the `source_kind='one_time'` revoke filter (removal stays subscription.canceled's job). The
  // test after next pins that actual behavior; the ADR-0269 §6 residual (no subscription-state
  // tracking, no dunning handling) is unchanged.
  test("a one-time purchase refund stays bounded — a sibling SUBSCRIPTION grant's credits and entitlement are untouched (ADR-0269 §6 boundary)", async () => {
    const acct = "acct_refund_bounded";
    // The subscription's own credits + STATIC entitlement grant (source_kind='subscription').
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "inv_bound", {
          priceId: EDITION_PLAN_ID,
          billingReason: "subscription_create",
        }),
      ),
    );
    // A one-time multi-line purchase of the SAME entitlement id (refcount) + a credit pack, same
    // payment id (one Paddle transaction, one delivery).
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompletedMulti(acct, "pi_bound", [
          { priceId: ONETIME_EDITION_ID, quantity: 1 },
          { priceId: CREDIT_PACK_ID, quantity: 1 },
        ]),
      ),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]);
    const balBefore = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(balBefore).toBe(17_000); // 12000 subscription + 5000 one-time pack

    // Refund ONLY the one-time purchase.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, refundCompleted(acct, "pi_bound")),
    );

    // The entitlement SURVIVES — the subscription's static grant still backs it (refcount).
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]);
    // Only the one-time purchase's 5000 credits were clawed — the subscription's 12000 untouched.
    const balAfter = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(balAfter).toBe(12_000);
  });

  // The ACTUAL subscription-payment-refund behavior (see the corrected comment above): the cycle's
  // unspent credits ARE clawed — bounded to that cycle's own grant — and the entitlement survives.
  test("a refund keyed to a subscription cycle's transaction id claws that cycle's unspent credits, never the entitlement", async () => {
    const acct = "acct_refund_subpay";
    // Paddle id-space overlap: the granting invoice's id IS the cycle's transaction id.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "txn_sub_cycle", {
          priceId: EDITION_PLAN_ID,
          billingReason: "subscription_create",
        }),
      ),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]);
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(
      12_000,
    );
    // A refund adjustment delivering that same transaction id as its payment id.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, refundCompleted(acct, "txn_sub_cycle")),
    );
    // The entitlement survives (source_kind filter — removal is subscription.canceled's job)...
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]);
    // ...and the cycle's own unspent credits are clawed, bounded to that grant.
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(0);
  });
});

describe("canonical lock order — the account billing lock is FIRST on every path (deadlock guard)", () => {
  /** The exact bigint id `withAdvisoryXactLock` derives for a key, captured via a probe executor —
   *  avoids exporting the private hash while still pinning real acquisition ids. */
  async function lockIdFor(key: string): Promise<string> {
    let captured = "";
    const probe: TenantExecutor = {
      query: async (_sql: string, params?: unknown[]) => {
        captured = String(params?.[0] ?? "");
        return { rows: [] };
      },
      exec: async () => undefined,
    };
    await withAdvisoryXactLock(probe, key, async () => {});
    return captured;
  }

  /** Pass-through executor recording every advisory-lock acquisition in transaction order. */
  function lockRecording(tx: TenantExecutor, locks: string[]): TenantExecutor {
    return {
      query: (sql, params) => {
        if (sql.includes("pg_advisory_xact_lock")) {
          locks.push(String(params?.[0] ?? ""));
        }
        return tx.query(sql, params);
      },
      exec: (sql) => tx.exec(sql),
    };
  }

  // Pins the ABBA-deadlock guard: every mutating billing path acquires the account billing lock
  // (the coverage key) BEFORE any other advisory lock — the whole-transaction refund, per-line
  // adjustment, invoice grant, and cancel revoke may interleave freely across deliveries, and a
  // single canonical first lock means no acquisition order can invert between them.
  test("whole-txn refund, per-line refund, invoice.paid, and cancel all take the account lock before the claw lock", async () => {
    const acct = "acct_lock_order";
    const accountLock = await lockIdFor(`entitlement:coverage:${acct}`);
    const clawLock = await lockIdFor(`credits:claw:${acct}:pi_lo`);

    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, purchaseCompleted(acct, "pi_lo", CREDIT_PACK_ID)),
    );

    // invoice.paid (grant path — takes the account lock before the wallet-row grant).
    let locks: string[] = [];
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        lockRecording(tx, locks),
        invoicePaid(acct, "in_lo", {
          priceId: EDITION_PLAN_ID,
          billingReason: "subscription_create",
        }),
      ),
    );
    expect(locks[0]).toBe(accountLock);

    // Whole-transaction refund: account lock strictly before the claw lock.
    locks = [];
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        lockRecording(tx, locks),
        refundCompleted(acct, "pi_lo"),
      ),
    );
    expect(locks[0]).toBe(accountLock);
    expect(locks).toContain(clawLock);
    expect(locks.indexOf(clawLock)).toBeGreaterThan(0);

    // Per-line adjustment (items empty — the claw lock is still taken up front): same order.
    locks = [];
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        lockRecording(tx, locks),
        refundPerLine(acct, "pi_lo", "adj_lo", []),
      ),
    );
    expect(locks[0]).toBe(accountLock);
    expect(locks).toContain(clawLock);
    expect(locks.indexOf(clawLock)).toBeGreaterThan(0);

    // subscription.canceled (mirror sweep now serialized with a racing mint).
    locks = [];
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(lockRecording(tx, locks), {
        type: "subscription.canceled",
        sourceEventId: "evt_lo_c",
        accountId: acct,
        subscriptionId: "sub_lo",
      }),
    );
    expect(locks[0]).toBe(accountLock);
  });
});

describe("applyBillingEvent — entitlement grant on cycle (ADR-0071)", () => {
  test("an edition plan grants credits AND the plan's entitlement in one transaction", async () => {
    const acct = "acct_ent";
    const bal = await withTenant(tp.pg, acct, async (tx) => {
      await applyBillingEvent(
        tx,
        invoicePaid(acct, "in_ent", { priceId: EDITION_PLAN_ID }),
      );
      return balance(tx, acct);
    });
    expect(bal).toBe(12000); // the edition plan's creditsPerCycle
    const ents = await withTenant(tp.pg, acct, (tx) =>
      readEntitlements(tx, acct),
    );
    expect(ents).toEqual(["compliance"]); // the plan's purchased id (expanded at the gate, not here)
  });

  test("a renewal cycle re-confirms the same entitlement idempotently (no duplicate)", async () => {
    const acct = "acct_ent_renew";
    // First cycle.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "in_y1", { priceId: EDITION_PLAN_ID }),
      ),
    );
    // Next cycle — a DISTINCT invoice → credits grant again, but the entitlement is already held.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "in_y2", { priceId: EDITION_PLAN_ID }),
      ),
    );
    const ents = await withTenant(tp.pg, acct, (tx) =>
      readEntitlements(tx, acct),
    );
    expect(ents).toEqual(["compliance"]); // one row, not two
    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(24000); // credits DID accrue twice (two distinct invoices)
  });

  test("G18/G7 (audit 2026-07-07): a Resend of the SAME invoice never ratchets the coverage horizon", async () => {
    // The audit's exact bug: upsertSubscriptionGrants's ON-CONFLICT DO-UPDATE recomputes
    // updates_expires_at = GREATEST(existing, now()+cadence) with no per-invoice idempotency key,
    // so a resent invoice.paid (fresh event_id, same invoiceId) used to push the horizon forward by
    // the wall-clock gap between the two calls — for free, no new payment. The G7 fix (this file's
    // withIdempotentSideEffect gate, keyed on the STABLE invoiceId) closes it as a side effect: a
    // resend skips upsertSubscriptionGrants entirely, so the raw horizon column cannot move at all.
    // A `coversOwnedEntitlements` (Developer) plan against an OWNED one-time entitlement is the
    // exact ADR-0269 coverage-mirror shape the audit's evidence cites.
    const acct = "acct_g18_horizon";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompleted(acct, "pi_g18", ONETIME_EDITION_ID),
      ),
    );
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "in_g18", {
          priceId: PLAN_ID, // coversOwnedEntitlements: true
          eventId: "evt_g18_a",
        }),
      ),
    );
    const readHorizon = async (): Promise<string | undefined> => {
      const rows = await tp.query<{ updates_expires_at: string | Date }>(
        `SELECT updates_expires_at FROM entitlement_grant
           WHERE account_id = $1 AND source_kind = 'subscription' AND entitlement_id = $2`,
        [acct, "compliance"],
      );
      const raw = rows[0]?.updates_expires_at;
      return raw === undefined ? undefined : new Date(raw).toISOString();
    };
    const horizonAfterFirst = await readHorizon();
    expect(horizonAfterFirst).toBeDefined();
    // Resend: SAME invoice id, FRESH event id — models the Paddle dashboard "Resend" some time later.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "in_g18", {
          priceId: PLAN_ID,
          eventId: "evt_g18_b",
        }),
      ),
    );
    const horizonAfterResend = await readHorizon();
    // Byte-identical, not merely "close" — the resend touched nothing.
    expect(horizonAfterResend).toBe(horizonAfterFirst);
  });

  test("a credits-only plan grants no entitlement (entitlements: [])", async () => {
    const acct = "acct_ent_none";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, invoicePaid(acct, "in_co")),
    );
    const ents = await withTenant(tp.pg, acct, (tx) =>
      readEntitlements(tx, acct),
    );
    expect(ents).toEqual([]);
  });

  test("a non-granting reason (proration) grants no entitlement either", async () => {
    const acct = "acct_ent_prorate";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "in_pr", {
          priceId: EDITION_PLAN_ID,
          billingReason: "subscription_update",
        }),
      ),
    );
    const ents = await withTenant(tp.pg, acct, (tx) =>
      readEntitlements(tx, acct),
    );
    expect(ents).toEqual([]); // gated out before the grant, same as the credit path
  });
});

describe("applyBillingEvent — Paddle per-line partial refund (ADR-0218)", () => {
  test("a per-line FULL refund of ONE cart line revokes only that line's grant + claws only its credits", async () => {
    const acct = "acct_pl_full";
    // A cart: a compliance edition line (0 credits) + a credit-pack line (5000 credits).
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompletedMulti(acct, "txn_plf", [
          {
            priceId: ONETIME_EDITION_ID,
            quantity: 1,
            itemId: "txnitm_ed",
            chargedAmount: 74900,
          },
          {
            priceId: CREDIT_PACK_ID,
            quantity: 1,
            itemId: "txnitm_pack",
            chargedAmount: 5000,
          },
        ]),
      ),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]);
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(
      PACK_CREDITS,
    );
    // Refund ONLY the pack line, in full.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        refundPerLine(acct, "txn_plf", "adj_plf", [
          { itemId: "txnitm_pack", amountRefunded: 5000, fullyRefunded: true },
        ]),
      ),
    );
    // The pack's credits are clawed; the edition line keeps its entitlement.
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(0);
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]);
  });

  test("a two-line-backed edition survives until BOTH lines are refunded (fork B-1 refcount)", async () => {
    const acct = "acct_pl_refcount";
    // Two cart lines BOTH grant `compliance` (distinct txnitm_ ids → two junction rows, fork B-1).
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompletedMulti(acct, "txn_rc", [
          {
            priceId: ONETIME_EDITION_ID,
            quantity: 1,
            itemId: "txnitm_a",
            chargedAmount: 74900,
          },
          {
            priceId: ONETIME_EDITION_ID,
            quantity: 1,
            itemId: "txnitm_b",
            chargedAmount: 74900,
          },
        ]),
      ),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]);
    // Refund line A only — line B still backs the entitlement (refcount > 0).
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        refundPerLine(acct, "txn_rc", "adj_a", [
          { itemId: "txnitm_a", amountRefunded: 74900, fullyRefunded: true },
        ]),
      ),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]);
    // Refund line B too — refcount hits 0, the edition is lost.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        refundPerLine(acct, "txn_rc", "adj_b", [
          { itemId: "txnitm_b", amountRefunded: 74900, fullyRefunded: true },
        ]),
      ),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual([]);
  });

  test("per-line refunds that empty the purchase flip order_record to 'refunded' (SHIP-audit)", async () => {
    const acct = "acct_pl_orderflip";
    const orderStatus = async (): Promise<string | undefined> => {
      const rows = await withTenant(tp.pg, acct, async (tx) => {
        const r = await tx.query<{ status: string }>(
          `SELECT status FROM order_record WHERE source_event_id = 'txn_of' AND kind = 'purchase'`,
        );
        return r.rows;
      });
      return rows[0]?.status;
    };
    // Two edition lines (0 credits) — Paddle types a line-by-line full refund as 'partial', so
    // without the flip this order would stay 'paid' forever and the affiliate report would keep
    // paying full commission on it.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompletedMulti(acct, "txn_of", [
          {
            priceId: ONETIME_EDITION_ID,
            quantity: 1,
            itemId: "txnitm_c",
            chargedAmount: 74900,
          },
          {
            priceId: CREDIT_PACK_ID,
            quantity: 1,
            itemId: "txnitm_d",
            chargedAmount: 5000,
          },
        ]),
      ),
    );
    expect(await orderStatus()).toBe("paid");
    // Refund the edition line only: a grant remains active on the pack? No — the pack grants
    // CREDITS, not an entitlement; but its credits are still un-clawed, so the purchase is NOT
    // verifiably empty and the order must stay 'paid' (the report's partialRefund flag owns it).
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        refundPerLine(acct, "txn_of", "adj_of_1", [
          { itemId: "txnitm_c", amountRefunded: 74900, fullyRefunded: true },
        ]),
      ),
    );
    expect(await orderStatus()).toBe("paid");
    // Refund the pack line too — no active grants, no un-clawed credits: the purchase is empty
    // and the order flips, matching what a whole-transaction refund would have done.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        refundPerLine(acct, "txn_of", "adj_of_2", [
          { itemId: "txnitm_d", amountRefunded: 5000, fullyRefunded: true },
        ]),
      ),
    );
    expect(await orderStatus()).toBe("refunded");
  });

  test("a dollar-PARTIAL refund claws PROPORTIONAL credits (floor) with provenance; entitlement intact (fork A-1)", async () => {
    const acct = "acct_pl_partial";
    // A pack line: 5000 credits, charged 3000 minor units — and an edition line (0 credits).
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompletedMulti(acct, "txn_pp", [
          {
            priceId: CREDIT_PACK_ID,
            quantity: 1,
            itemId: "txnitm_pack",
            chargedAmount: 3000,
          },
          {
            priceId: ONETIME_EDITION_ID,
            quantity: 1,
            itemId: "txnitm_ed",
            chargedAmount: 74900,
          },
        ]),
      ),
    );
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(
      PACK_CREDITS,
    );
    // Refund 1000 of the pack's 3000 charged → floor(5000 * 1000 / 3000) = floor(1666.6…) = 1666.
    // Also a dollar-partial on the edition line — a partial NEVER revokes an entitlement (fork A-1).
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        refundPerLine(acct, "txn_pp", "adj_pp", [
          { itemId: "txnitm_pack", amountRefunded: 1000, fullyRefunded: false },
          { itemId: "txnitm_ed", amountRefunded: 10000, fullyRefunded: false },
        ]),
      ),
    );
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(
      PACK_CREDITS - 1666,
    );
    // The edition entitlement is untouched by the dollar-partial (fork A-1).
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]);
    // ADR-0212: the proportional claw persists round-DOWN provenance keyed on the refunded amount.
    const prov = await tp.query<{
      amount: number;
      rounding_raw: number | null;
      rounding_mode: string | null;
    }>(
      `SELECT amount, rounding_raw, rounding_mode FROM credit_event WHERE account_id = $1 AND event_type = 'refund_clawback'`,
      [acct],
    );
    expect(prov).toEqual([
      { amount: -1666, rounding_raw: 1000, rounding_mode: "down" },
    ]);
  });

  // ADR-0394 at the HANDLER seam. The store primitive has its own tests; these drive a real
  // refund.completed through applyBillingEvent, which is what the store tests cannot prove.
  describe("refunded_amount netting through the handler (ADR-0394)", () => {
    /** Every grant row's (charged, refunded) for one account, ordered by entitlement. */
    async function paidRows(
      acct: string,
    ): Promise<{ charged: number | null; refunded: number | null }[]> {
      const r = await tp.query<{
        charged_amount: number | null;
        refunded_amount: number | null;
      }>(
        `SELECT charged_amount, refunded_amount FROM entitlement_grant
          WHERE account_id = $1 ORDER BY entitlement_id`,
        [acct],
      );
      return r.map((row) => ({
        charged: row.charged_amount,
        refunded: row.refunded_amount,
      }));
    }

    test("a dollar-partial on a ZERO-CREDIT line still records the refund — the case the clawback ledger never sees", async () => {
      const acct = "acct_f2_handler_zero";
      // An edition line grants an entitlement and NO credits, so no clawback row is ever written
      // for it. That is exactly the row an upgrade quote reads, and why recordLineRefund sits
      // outside the claw guard.
      await withTenant(tp.pg, acct, (tx) =>
        applyBillingEvent(
          tx,
          purchaseCompletedMulti(acct, "txn_f2z", [
            {
              priceId: ONETIME_EDITION_ID,
              quantity: 1,
              itemId: "txnitm_f2z",
              chargedAmount: 74900,
            },
          ]),
        ),
      );
      expect(await paidRows(acct)).toEqual([
        { charged: 74900, refunded: null },
      ]);
      await withTenant(tp.pg, acct, (tx) =>
        applyBillingEvent(
          tx,
          refundPerLine(acct, "txn_f2z", "adj_f2z", [
            {
              itemId: "txnitm_f2z",
              amountRefunded: 20000,
              fullyRefunded: false,
            },
          ]),
        ),
      );
      expect(await paidRows(acct)).toEqual([
        { charged: 74900, refunded: 20000 },
      ]);
      // The stamped charge never moves; the netted figure is what a quote must read.
      expect(netCharged(74900, 20000)).toBe(54900);
      // No clawback row exists for this line — the ledger anchor was genuinely unavailable here.
      expect(
        await tp.query(
          `SELECT 1 FROM credit_event WHERE account_id = $1 AND event_type = 'refund_clawback'`,
          [acct],
        ),
      ).toEqual([]);
      // The entitlement survives a dollar-partial (fork A-1), so the row stays quote-visible.
      expect(
        await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
      ).toEqual(["compliance"]);
    });

    test("a redelivered adjustment is inert through the whole handler, not just the store call", async () => {
      const acct = "acct_f2_handler_replay";
      await withTenant(tp.pg, acct, (tx) =>
        applyBillingEvent(
          tx,
          purchaseCompletedMulti(acct, "txn_f2r", [
            {
              priceId: ONETIME_EDITION_ID,
              quantity: 1,
              itemId: "txnitm_f2r",
              chargedAmount: 164900,
            },
          ]),
        ),
      );
      const refund = () =>
        withTenant(tp.pg, acct, (tx) =>
          applyBillingEvent(
            tx,
            refundPerLine(acct, "txn_f2r", "adj_f2r", [
              {
                itemId: "txnitm_f2r",
                amountRefunded: 40000,
                fullyRefunded: false,
              },
            ]),
          ),
        );
      await refund();
      await refund(); // Paddle redelivers the same adjustment
      // The reverted in-place decrement took 164900 -> 84900 on this exact sequence.
      expect(await paidRows(acct)).toEqual([
        { charged: 164900, refunded: 40000 },
      ]);
    });

    test("a FULLY-refunded line records no refund — its grant is revoked, so there is no floor to net", async () => {
      const acct = "acct_f2_handler_full";
      await withTenant(tp.pg, acct, (tx) =>
        applyBillingEvent(
          tx,
          purchaseCompletedMulti(acct, "txn_f2f", [
            {
              priceId: ONETIME_EDITION_ID,
              quantity: 1,
              itemId: "txnitm_f2f",
              chargedAmount: 74900,
            },
          ]),
        ),
      );
      await withTenant(tp.pg, acct, (tx) =>
        applyBillingEvent(
          tx,
          refundPerLine(acct, "txn_f2f", "adj_f2f", [
            {
              itemId: "txnitm_f2f",
              amountRefunded: 74900,
              fullyRefunded: true,
            },
          ]),
        ),
      );
      // Revoked, and deliberately no refunded_amount written (ADR-0394 decision 4).
      expect(await paidRows(acct)).toEqual([
        { charged: 74900, refunded: null },
      ]);
      expect(
        await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
      ).toEqual([]);
    });
  });

  test("per-line clawback is idempotent per (adjustment, item); two sequential partials both claw", async () => {
    const acct = "acct_pl_idem";
    // A pack line: 5000 credits, charged 10000 minor units.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompletedMulti(acct, "txn_idem", [
          {
            priceId: CREDIT_PACK_ID,
            quantity: 1,
            itemId: "txnitm_pack",
            chargedAmount: 10000,
          },
        ]),
      ),
    );
    // Adjustment A: refund 2000/10000 → floor(5000 * 2000 / 10000) = 1000 clawed.
    const adjA = refundPerLine(acct, "txn_idem", "adj_A", [
      { itemId: "txnitm_pack", amountRefunded: 2000, fullyRefunded: false },
    ]);
    await withTenant(tp.pg, acct, (tx) => applyBillingEvent(tx, adjA));
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(4000);
    // A redelivery of adjustment A writes NO second clawback (per-delivery key dedups).
    await withTenant(tp.pg, acct, (tx) => applyBillingEvent(tx, adjA));
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(4000);
    // A DISTINCT adjustment B on the same line still claws (sequential partials up to the total).
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        refundPerLine(acct, "txn_idem", "adj_B", [
          { itemId: "txnitm_pack", amountRefunded: 3000, fullyRefunded: false },
        ]),
      ),
    );
    // floor(5000 * 3000 / 10000) = 1500 more clawed → 4000 - 1500 = 2500.
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(2500);
  });

  test("a partial then a FULL on the same line reclaims exactly the line's grant, never over-claws", async () => {
    const acct = "acct_pl_pf";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompletedMulti(acct, "txn_pf", [
          {
            priceId: CREDIT_PACK_ID,
            quantity: 1,
            itemId: "txnitm_pack",
            chargedAmount: 5000,
          },
        ]),
      ),
    );
    // Partial refund 2000/5000 → floor(5000 * 2000 / 5000) = 2000 clawed → balance 3000.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        refundPerLine(acct, "txn_pf", "adj_1", [
          { itemId: "txnitm_pack", amountRefunded: 2000, fullyRefunded: false },
        ]),
      ),
    );
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(3000);
    // Now a FULL-item refund of the SAME line: claws only the remaining 3000 (granted 5000 − clawed
    // 2000), never the whole 5000 again — the wallet lands at 0, not negative.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        refundPerLine(acct, "txn_pf", "adj_2", [
          { itemId: "txnitm_pack", amountRefunded: 3000, fullyRefunded: true },
        ]),
      ),
    );
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(0);
  });

  test("a per-line FULL refund claws only the UNSPENT remainder, never negative", async () => {
    const acct = "acct_pl_spent";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompletedMulti(acct, "txn_sp", [
          {
            priceId: CREDIT_PACK_ID,
            quantity: 1,
            itemId: "txnitm_pack",
            chargedAmount: 5000,
          },
        ]),
      ),
    );
    // Spend 4000 of the 5000.
    await withTenant(tp.pg, acct, (tx) =>
      debit(tx, {
        eventType: "codegen_debit",
        accountId: acct,
        amount: asCredits(4000),
        idempotencyKey: "spend_pl",
      }),
    );
    // Full-line refund: line granted 5000 but only 1000 is unspent — claw is bounded to the balance.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        refundPerLine(acct, "txn_sp", "adj_sp", [
          { itemId: "txnitm_pack", amountRefunded: 5000, fullyRefunded: true },
        ]),
      ),
    );
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(0);
  });

  test("a whole-txn FULL adjustment after per-line partial claws never over-claws or spills onto another purchase (CAISSON-5)", async () => {
    const acct = "acct_pl_whole_after_partial";
    // Purchase A: two credit-bearing lines (3000 + 2000 = 5000 total granted), paymentId txn_A.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompletedMulti(acct, "txn_A", [
          {
            priceId: CREDIT_PACK_ID,
            quantity: 1,
            itemId: "txnitm_a1",
            chargedAmount: 3000,
          },
          {
            priceId: CREDIT_PACK_ID,
            quantity: 1,
            itemId: "txnitm_a2",
            chargedAmount: 2000,
          },
        ]),
      ),
    );
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(
      2 * PACK_CREDITS,
    );
    // Per-line FULL refund of line 1 only — claws exactly that line's 3000-equivalent grant
    // (PACK_CREDITS per line here, since each line is its own CREDIT_PACK_ID purchase-line).
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        refundPerLine(acct, "txn_A", "adj_a1", [
          { itemId: "txnitm_a1", amountRefunded: 3000, fullyRefunded: true },
        ]),
      ),
    );
    const afterPartial = await withTenant(tp.pg, acct, (tx) =>
      balance(tx, acct),
    );
    expect(afterPartial).toBe(PACK_CREDITS); // only line 1's grant clawed so far
    // A SEPARATE purchase B lands on the SAME account/wallet — must be untouched by A's refund.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, purchaseCompleted(acct, "txn_B", CREDIT_PACK_ID)),
    );
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(
      2 * PACK_CREDITS,
    );
    // Now a WHOLE-TRANSACTION full refund lands on A (e.g. the buyer disputes the whole charge). The
    // pre-fix bug would re-claw the full original 2*PACK_CREDITS granted for A (ignoring the already-
    // clawed line 1), draining the wallet down past A's own remainder and into B's untouched credits.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, refundCompleted(acct, "txn_A")),
    );
    const finalBalance = await withTenant(tp.pg, acct, (tx) =>
      balance(tx, acct),
    );
    // Exactly A's remaining unclawed line (PACK_CREDITS) is clawed — B's PACK_CREDITS survive intact,
    // never spilled into by A's whole-txn refund.
    expect(finalBalance).toBe(PACK_CREDITS);
    // Total ever clawed from A across BOTH refunds (the line-1 partial + the bounded whole-txn full)
    // equals exactly what A originally granted — never more (the over-claw this test pins).
    const totalGrantedA = 2 * PACK_CREDITS;
    const ledger = await withTenant(tp.pg, acct, (tx) => getLedger(tx, acct));
    const clawedFromA = ledger
      .filter(
        (e) =>
          e.event_type === "refund_clawback" &&
          (e.source_event_id === "txn_A" ||
            e.source_event_id?.startsWith("adj_a1:")),
      )
      .reduce((sum, e) => sum + -e.amount, 0);
    expect(clawedFromA).toBe(totalGrantedA);
  });

  test("a per-line partial after a whole-txn FULL refund never over-claws (reversed delivery, CAISSON-5)", async () => {
    // The mirror image of the test above: the whole-transaction refund lands FIRST, then a per-line
    // partial adjustment for one of its lines arrives afterward (a delayed/out-of-order webhook). The
    // whole-txn claw's row carries line_item_id NULL, so lineCreditLedger's per-line filter alone
    // would see this line as un-clawed and re-claw its full grant a second time — draining a SEPARATE
    // purchase's untouched credits from the same fungible wallet. The purchase-level remainder bound
    // must catch this even though lineCreditLedger cannot see the earlier whole-txn row.
    const acct = "acct_pl_partial_after_whole";
    // Purchase C: two credit-bearing lines (2 x PACK_CREDITS granted), paymentId txn_C.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompletedMulti(acct, "txn_C", [
          {
            priceId: CREDIT_PACK_ID,
            quantity: 1,
            itemId: "txnitm_c1",
            chargedAmount: 3000,
          },
          {
            priceId: CREDIT_PACK_ID,
            quantity: 1,
            itemId: "txnitm_c2",
            chargedAmount: 2000,
          },
        ]),
      ),
    );
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(
      2 * PACK_CREDITS,
    );
    // A SEPARATE purchase D lands on the SAME account/wallet — must stay untouched by C's refund.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, purchaseCompleted(acct, "txn_D", CREDIT_PACK_ID)),
    );
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(
      3 * PACK_CREDITS,
    );
    // WHOLE-TRANSACTION full refund lands FIRST — claws all of C's 2 x PACK_CREDITS.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, refundCompleted(acct, "txn_C")),
    );
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(
      PACK_CREDITS, // only D's credits remain
    );
    // THEN a per-line partial for one of C's lines arrives. The pre-fix bug reads
    // lineCreditLedger("txnitm_c1") — which never saw the whole-txn claw's NULL-line row — as
    // granted=PACK_CREDITS, clawed=0, and re-claws the full PACK_CREDITS again, draining D's balance
    // to 0.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        refundPerLine(acct, "txn_C", "adj_c1", [
          { itemId: "txnitm_c1", amountRefunded: 3000, fullyRefunded: true },
        ]),
      ),
    );
    const finalBalance = await withTenant(tp.pg, acct, (tx) =>
      balance(tx, acct),
    );
    // D's PACK_CREDITS survive untouched — the per-line claw is bounded to nothing further, since C's
    // purchase-level remainder is already fully spent by the earlier whole-txn claw.
    expect(finalBalance).toBe(PACK_CREDITS);
    // Total ever clawed from C across BOTH refunds equals exactly what C originally granted, never more.
    const totalGrantedC = 2 * PACK_CREDITS;
    const ledger = await withTenant(tp.pg, acct, (tx) => getLedger(tx, acct));
    const clawedFromC = ledger
      .filter(
        (e) =>
          e.event_type === "refund_clawback" &&
          (e.source_event_id === "txn_C" ||
            e.source_event_id?.startsWith("adj_c1:")),
      )
      .reduce((sum, e) => sum + -e.amount, 0);
    expect(clawedFromC).toBe(totalGrantedC);
  });

  test("a Stripe-style partial (fullyRefunded=false, no items[]) stays a no-op (ADR-0218 D-1)", async () => {
    const acct = "acct_pl_noitems";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompletedMulti(acct, "pi_ni", [
          { priceId: CREDIT_PACK_ID, quantity: 1 },
          { priceId: ONETIME_EDITION_ID, quantity: 1 },
        ]),
      ),
    );
    // A partial refund with no per-line data (Stripe / itemless) must not revoke or claw.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, refundCompleted(acct, "pi_ni", false)),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]);
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(
      PACK_CREDITS,
    );
  });
});

describe("applyBillingEvent — updates-renewal lines (ADR-0244/0251)", () => {
  const RENEWAL_COMPLIANCE_ID = "pri_01kwvz6kzh4h43aec3r5rs5je4"; // the live sandbox compliance-renewal price
  // The legacy-keyed sandbox renewal row (`renewsEntitlement: "ai-kit"` → canonical "ai-production").
  const RENEWAL_AI_PRODUCTION_ID = "pri_01kwvz6m46s5tj4k2a09kcaf9s";
  const MODULE_ID = "price_field_crypto_module_PLACEHOLDER"; // grants "field-crypto", 0 credits

  test("a renewal line EXTENDS the window — no new grant, no credits, no push", async () => {
    const acct = "acct_renewal_extend";
    // Precondition: an active one_time compliance grant to renew.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompleted(acct, "pay_ren_base", ONETIME_EDITION_ID),
      ),
    );

    const effect = await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompleted(acct, "pay_ren_1", RENEWAL_COMPLIANCE_ID),
      ),
    );
    expect(effect.grantedEntitlements).toEqual([]); // nothing granted → no Discord/PostHog push

    // The renewal surfaces its own signal for the post-commit renewal-confirmation email —
    // the SAME window `computeUpdatesWindows` would return for the next /issue.
    const windows = await withTenant(tp.pg, acct, (tx) =>
      computeUpdatesWindows(tx, acct),
    );
    const newWindowEnd = windows.compliance;
    if (newWindowEnd === undefined)
      throw new Error("expected a computed window");
    expect(effect.renewedEntitlements).toEqual([
      { entitlementId: "compliance", newWindowEnd },
    ]);

    // No credits landed, no second grant row — the ORIGINAL row gained updates_expires_at.
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(0);
    const rows = await tp.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM entitlement_grant WHERE account_id = $1`,
      [acct],
    );
    expect((rows[0] as { n: number }).n).toBe(1);
    const win = await tp.query<{ set: boolean }>(
      `SELECT (updates_expires_at IS NOT NULL) AS set FROM entitlement_grant WHERE account_id = $1`,
      [acct],
    );
    expect((win[0] as { set: boolean }).set).toBe(true);
  });

  test("a MIXED cart fulfills the purchase line AND the renewal line in one event", async () => {
    const acct = "acct_renewal_mixed";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompleted(acct, "pay_mix_base", ONETIME_EDITION_ID),
      ),
    );

    const effect = await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompletedMulti(acct, "pay_mix_1", [
          { priceId: MODULE_ID, quantity: 1, itemId: "txnitm_mod" },
          { priceId: RENEWAL_COMPLIANCE_ID, quantity: 1, itemId: "txnitm_ren" },
        ]),
      ),
    );
    // The purchase line granted; the renewal line stayed out of the push list, but IS surfaced
    // in its own renewedEntitlements signal (the mixed-cart both-emails case, app.ts).
    expect(effect.grantedEntitlements).toEqual(["field-crypto"]);
    const windows = await withTenant(tp.pg, acct, (tx) =>
      computeUpdatesWindows(tx, acct),
    );
    const newWindowEnd = windows.compliance;
    if (newWindowEnd === undefined)
      throw new Error("expected a computed window");
    expect(effect.renewedEntitlements).toEqual([
      { entitlementId: "compliance", newWindowEnd },
    ]);
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance", "field-crypto"]);
    // The renewal stamped the COMPLIANCE row only.
    const rows = await tp.query<{ entitlement_id: string; set: boolean }>(
      `SELECT entitlement_id, (updates_expires_at IS NOT NULL) AS set
         FROM entitlement_grant WHERE account_id = $1 ORDER BY entitlement_id`,
      [acct],
    );
    expect(rows).toEqual([
      { entitlement_id: "compliance", set: true },
      { entitlement_id: "field-crypto", set: false },
    ]);
  });

  test("a renewal against an OLD-rename-keyed grant row still surfaces renewedEntitlements (alias fold)", async () => {
    const acct = "acct_renewal_legacy";
    // A pre-rename buyer: the grant row stores the OLD module slug, while the renewal price resolves to
    // the CURRENT canonical id (`ai-production`). ADR-0270 emptied the edition spine, so this exercises
    // the fold against a surviving-alias STAND-IN (`ai-production-old → ai-production`) — the shape the
    // next module rename takes. The extension matches via the alias group; the email-surfacing read-back
    // must fold the same group or the notice silently drops (windows key by the RAW stored id — the
    // fable-audit F2 regression).
    await withRenameAlias("ai-production-old", "ai-production", async () => {
      await withTenant(tp.pg, acct, (tx) =>
        grantEntitlements(tx, {
          accountId: acct,
          entitlementIds: ["ai-production-old"],
          sourceEventId: "pay_legacy_base",
          source: { kind: "one_time", purchaseId: "pay_legacy_base" },
        }),
      );

      const effect = await withTenant(tp.pg, acct, (tx) =>
        applyBillingEvent(
          tx,
          purchaseCompleted(acct, "pay_legacy_ren", RENEWAL_AI_PRODUCTION_ID),
        ),
      );

      const windows = await withTenant(tp.pg, acct, (tx) =>
        computeUpdatesWindows(tx, acct),
      );
      const newWindowEnd = windows["ai-production-old"]; // keyed by the raw stored id
      if (newWindowEnd === undefined)
        throw new Error("expected a computed window on the old-spelling row");
      expect(effect.renewedEntitlements).toEqual([
        { entitlementId: "ai-production", newWindowEnd },
      ]);
    });
  });

  test("a renewal WITHOUT an active grant THROWS (fail-closed — never mints a grant)", async () => {
    const acct = "acct_renewal_nogrant";
    await expect(
      withTenant(tp.pg, acct, (tx) =>
        applyBillingEvent(
          tx,
          purchaseCompleted(acct, "pay_ren_bad", RENEWAL_COMPLIANCE_ID),
        ),
      ),
    ).rejects.toThrow(ConfigError);
    // Nothing landed: no grant row, no window stamp.
    const rows = await tp.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM entitlement_grant WHERE account_id = $1`,
      [acct],
    );
    expect((rows[0] as { n: number }).n).toBe(0);
  });

  test("refunding a renewal transaction UN-EXTENDS the window back to the original purchase window (ADR-0251 Consequences)", async () => {
    const acct = "acct_renewal_refund";
    // Original one-time compliance buy, window pinned for a deterministic baseline (2027-01-05).
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompleted(acct, "pay_rf_base", ONETIME_EDITION_ID),
      ),
    );
    await tp.query(
      `UPDATE entitlement_grant SET granted_at = $2 WHERE account_id = $1`,
      [acct, "2026-01-05T00:00:00.000Z"],
    );
    // Renewal (its own transaction) extends the window +12 months.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompleted(acct, "pay_rf_ren", RENEWAL_COMPLIANCE_ID),
      ),
    );
    expect(
      (await withTenant(tp.pg, acct, (tx) => computeUpdatesWindows(tx, acct)))
        .compliance,
    ).toBe("2028-01-05T00:00:00.000Z");

    // Refund the RENEWAL transaction (its paymentId). It granted no entitlement/credits, so the
    // revoke/claw are no-ops — the un-extend is the whole effect. The ORIGINAL grant stays active.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, refundCompleted(acct, "pay_rf_ren", true)),
    );
    expect(
      (await withTenant(tp.pg, acct, (tx) => computeUpdatesWindows(tx, acct)))
        .compliance,
    ).toBe("2027-01-05T00:00:00.000Z"); // back to the original purchase window, never below it
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]); // the original purchase is untouched — buyer keeps the module

    // A REDELIVERED refund (distinct event id, same payment) never double-shrinks (idempotent latch).
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, {
        ...refundCompleted(acct, "pay_rf_ren", true),
        sourceEventId: "evt_refund_pay_rf_ren_again",
      }),
    );
    expect(
      (await withTenant(tp.pg, acct, (tx) => computeUpdatesWindows(tx, acct)))
        .compliance,
    ).toBe("2027-01-05T00:00:00.000Z");
  });

  test("a per-line refund of a mixed cart's renewal line un-extends ONLY that renewal (sibling purchase line untouched)", async () => {
    const acct = "acct_renewal_refund_line";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompleted(acct, "pay_rfl_base", ONETIME_EDITION_ID),
      ),
    );
    await tp.query(
      `UPDATE entitlement_grant SET granted_at = $2
        WHERE account_id = $1 AND entitlement_id = 'compliance'`,
      [acct, "2026-01-05T00:00:00.000Z"],
    );
    // Mixed cart: a module purchase line + a compliance-renewal line.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompletedMulti(acct, "pay_rfl_mix", [
          { priceId: MODULE_ID, quantity: 1, itemId: "txnitm_mod" },
          {
            priceId: RENEWAL_COMPLIANCE_ID,
            quantity: 1,
            itemId: "txnitm_ren",
          },
        ]),
      ),
    );
    expect(
      (await withTenant(tp.pg, acct, (tx) => computeUpdatesWindows(tx, acct)))
        .compliance,
    ).toBe("2028-01-05T00:00:00.000Z");

    // Per-line FULL refund of ONLY the renewal line → un-extend compliance; field-crypto stays.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        refundPerLine(acct, "pay_rfl_mix", "adj_rfl", [
          { itemId: "txnitm_ren", amountRefunded: 0, fullyRefunded: true },
        ]),
      ),
    );
    expect(
      (await withTenant(tp.pg, acct, (tx) => computeUpdatesWindows(tx, acct)))
        .compliance,
    ).toBe("2027-01-05T00:00:00.000Z");
    // The purchased module line is unaffected — still entitled.
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance", "field-crypto"]);
  });
});

describe("ADR-0269 — a coversOwnedEntitlements plan (Developer) re-grants owned ids subscription-sourced", () => {
  /** A Developer-plan invoice on a chosen subscription id (the placeholder row carries
   *  coversOwnedEntitlements: true, ADR-0269 D1). */
  function developerInvoice(
    accountId: string,
    invoiceId: string,
    subscriptionId: string,
  ): DomainBillingEvent {
    return {
      type: "invoice.paid",
      sourceEventId: `evt_${invoiceId}`,
      accountId,
      amountTotal: 49900,
      currency: "usd",
      subscriptionId,
      priceId: PLAN_ID,
      billingReason: "subscription_cycle",
      invoiceId,
    };
  }

  test("the granting invoice re-grants every owned one_time id under the subscription; the pair's window EXTENDS to the coverage horizon; the paid horizon is grandfathered at cancel", async () => {
    const acct = "acct_dev_covers";
    // The buyer OWNS compliance (one-time buy) whose own window has LAPSED — the coverage
    // horizon is then the pair's live bound (max fold, ADR-0269 D2 hardened).
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompleted(acct, "pay_own", ONETIME_EDITION_ID),
      ),
    );
    await tp.query(
      `UPDATE entitlement_grant SET granted_at = $2
        WHERE account_id = $1 AND source_kind = 'one_time'`,
      [acct, "2025-01-05T00:00:00.000Z"],
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => computeUpdatesWindows(tx, acct)),
    ).toEqual({ compliance: "2026-01-05T00:00:00.000Z" });

    // Developer invoice.paid → the owned id is RE-GRANTED subscription-sourced (the
    // Compliance-Updates mirror made dynamic) and reported in grantedEntitlements.
    const effect = await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, developerInvoice(acct, "in_dev1", "sub_dev")),
    );
    expect(effect.grantedEntitlements).toEqual(["compliance"]);
    const rows = await tp.query<{ source_kind: string; status: string }>(
      `SELECT source_kind, status FROM entitlement_grant
        WHERE account_id = $1 AND entitlement_id = 'compliance' ORDER BY source_kind`,
      [acct],
    );
    expect(rows).toEqual([
      { source_kind: "one_time", status: "active" },
      { source_kind: "subscription", status: "active" },
    ]);
    // Covered → the signed window EXTENDS to the paid-through horizon (monthly cadence here):
    // present, bounded by the LAST PAID period — never a dropped/unbounded key (audit P1 2).
    const covered = await withTenant(tp.pg, acct, (tx) =>
      computeUpdatesWindows(tx, acct),
    );
    const horizon = Date.parse(covered.compliance ?? "");
    expect(horizon).toBeGreaterThan(Date.now() + 25 * 86_400_000);
    expect(horizon).toBeLessThan(Date.now() + 40 * 86_400_000);

    // A later cycle is idempotent per (account, id, subscription) — no duplicate rows.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, developerInvoice(acct, "in_dev2", "sub_dev")),
    );
    const count = await tp.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM entitlement_grant
        WHERE account_id = $1 AND entitlement_id = 'compliance' AND source_kind = 'subscription'`,
      [acct],
    );
    expect(count).toEqual([{ n: 1 }]);
    // The renewal EXTENDED the horizon on the same row (GREATEST, monotone).
    const extended = Date.parse(
      (await withTenant(tp.pg, acct, (tx) => computeUpdatesWindows(tx, acct)))
        .compliance ?? "",
    );
    expect(extended).toBeGreaterThanOrEqual(horizon);

    // subscription.canceled revokes exactly the re-grants; the OWNED grant survives (refcount)
    // and the pair KEEPS the paid horizon — a horizon is a fact about money actually received
    // (covered-period grandfathering, operator-locked 2026-07-06). It stops extending here.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, {
        type: "subscription.canceled",
        sourceEventId: "evt_dev_cancel",
        accountId: acct,
        subscriptionId: "sub_dev",
      }),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]); // one_time survives (refcount, ADR-0113)
    expect(
      Date.parse(
        (await withTenant(tp.pg, acct, (tx) => computeUpdatesWindows(tx, acct)))
          .compliance ?? "",
      ),
    ).toBe(extended); // grandfathered — bounded by the last PAID period, never unbounded
  });

  test("REFUND during coverage sweeps the mirror — a refunded product never survives subscription-sourced (audit P1 1)", async () => {
    const acct = "acct_dev_refund";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompleted(acct, "pay_ref", ONETIME_EDITION_ID),
      ),
    );
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, developerInvoice(acct, "in_ref1", "sub_ref")),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]);
    // Full refund of the backing purchase: BOTH the one_time grant and its coverage mirror fall.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, refundCompleted(acct, "pay_ref")),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual([]);
    expect(
      await withTenant(tp.pg, acct, (tx) => computeUpdatesWindows(tx, acct)),
    ).toEqual({});
    // The NEXT cycle's dynamic read finds nothing owned — the mirror never re-mints.
    const after = await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, developerInvoice(acct, "in_ref2", "sub_ref")),
    );
    expect(after.grantedEntitlements).toEqual([]);
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual([]);
  });

  test("an id bought MID-cycle joins at the NEXT granting invoice", async () => {
    const acct = "acct_dev_midcycle";
    // Cycle 1: nothing owned → the plan re-grants nothing (credits only).
    const first = await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, developerInvoice(acct, "in_mc1", "sub_mc")),
    );
    expect(first.grantedEntitlements).toEqual([]);
    // Mid-cycle one-time buy…
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompleted(acct, "pay_mc", ONETIME_EDITION_ID),
      ),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => computeUpdatesWindows(tx, acct)),
    ).not.toEqual({}); // not yet covered — joins at the next cycle
    // …joins at cycle 2. The pair's key stays PRESENT — a fresh purchase's own 12-month bound
    // already exceeds the monthly coverage horizon, so the max fold leaves it untouched.
    const second = await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, developerInvoice(acct, "in_mc2", "sub_mc")),
    );
    expect(second.grantedEntitlements).toEqual(["compliance"]);
    expect(
      Object.keys(
        await withTenant(tp.pg, acct, (tx) => computeUpdatesWindows(tx, acct)),
      ),
    ).toEqual(["compliance"]);
  });

  test("a plan WITHOUT the flag (Compliance-Updates) never re-grants other owned ids", async () => {
    const acct = "acct_noflag";
    // The buyer owns a credit pack (no entitlement) and pays a Compliance-Updates invoice —
    // only the plan's own static `compliance` grant lands; no dynamic re-grant of anything else.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, purchaseCompleted(acct, "pay_nf", CREDIT_PACK_ID)),
    );
    const effect = await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "in_nf", { priceId: EDITION_PLAN_ID }),
      ),
    );
    expect(effect.grantedEntitlements).toEqual(["compliance"]);
    const kinds = await tp.query<{
      entitlement_id: string;
      source_kind: string;
    }>(
      `SELECT entitlement_id, source_kind FROM entitlement_grant
        WHERE account_id = $1 ORDER BY entitlement_id`,
      [acct],
    );
    expect(kinds).toEqual([
      { entitlement_id: "compliance", source_kind: "subscription" },
    ]);
  });
});

describe("applyBillingEvent — ADR-0293 subscription-status + order-history review fixes", () => {
  // WR-02: a plan change on the SAME Paddle subscription id must move the subscription_status row
  // onto the new price — a stale ON CONFLICT that only refreshed status/updated_at would leave the
  // OLD plan reading "owned" (with a cancel control) and the NEW plan reading unowned (with none).
  test("upsertSubscriptionStatus on a changed price moves the row to the latest invoice's plan", async () => {
    const acct = "acct_price_change";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "in_price_1", { priceId: PLAN_ID }),
      ),
    );
    let rows = await withTenant(tp.pg, acct, (tx) =>
      readSubscriptionStatuses(tx, acct),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        subscriptionId: "sub_1",
        priceId: PLAN_ID,
        planTag: "developer",
        status: "active",
      }),
    ]);

    // A later invoice on the SAME subscription id, a DIFFERENT price (a plan change) — one row,
    // reflecting the newest invoice, never a stale price.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "in_price_2", { priceId: EDITION_PLAN_ID }),
      ),
    );
    rows = await withTenant(tp.pg, acct, (tx) =>
      readSubscriptionStatuses(tx, acct),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        subscriptionId: "sub_1",
        priceId: EDITION_PLAN_ID,
        planTag: "compliance_updates",
        status: "active",
      }),
    );
  });

  // IN-02: a negative-total invoice (a Paddle credit-note-adjusted invoice, or any other provider
  // oddity) must never brick the webhook — order_record's amount>=0 CHECK would otherwise roll back
  // the WHOLE transaction, including the real credit grant, and Paddle would retry the delivery
  // forever. The fix skips the order-history row; the grant must still land and the event must
  // still be applied (ack), never throw.
  test("a negative-total invoice grants credits, writes no order row, and never throws", async () => {
    const acct = "acct_negative_total";
    const bal = await withTenant(tp.pg, acct, async (tx) => {
      await applyBillingEvent(
        tx,
        invoicePaid(acct, "in_neg", { amountTotal: -500 }),
      );
      return balance(tx, acct);
    });
    expect(bal).toBe(CREDITS); // the credit grant is untouched by amountTotal being negative
    const orders = await withTenant(tp.pg, acct, (tx) =>
      readOrderRecords(tx, acct),
    );
    expect(orders).toEqual([]); // no order-history row for the negative-total invoice
  });
});

describe("cancel-before-grant ordering race (grant-time liveness check)", () => {
  test("a granting invoice AFTER subscription.canceled leaves no live entitlement grant; credits still land", async () => {
    const acct = "acct_cancel_race";
    const sub = "sub_race";
    // The cancel arrives FIRST — before ANY invoice for this subscription ever granted. The
    // tombstone it writes is what the late invoice's liveness check reads.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, subscriptionCanceled(acct, sub)),
    );
    // The (out-of-order) granting invoice for an entitlement-carrying plan lands afterwards.
    const effect = await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "in_race_1", {
          priceId: EDITION_PLAN_ID,
          subscriptionId: sub,
        }),
      ),
    );
    // No live grant — the leak this closes was an active row nothing would ever revoke.
    const grants = await withTenant(tp.pg, acct, (tx) =>
      readEntitlements(tx, acct),
    );
    expect(grants).toEqual([]);
    expect(effect.grantedEntitlements).toEqual([]); // no Discord/PostHog/email push either
    // Credits are honored — the payment was real; a refund of it claws them back.
    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(12000);
    // The tombstone is not resurrected to 'active' by the late invoice.
    const statuses = await withTenant(tp.pg, acct, (tx) =>
      readSubscriptionStatuses(tx, acct),
    );
    expect(statuses).toHaveLength(1);
    expect(statuses[0]?.status).toBe("canceled");
  });

  test("the normal order (grant then cancel) still revokes — the tombstone changes nothing there", async () => {
    const acct = "acct_cancel_normal";
    const sub = "sub_normal";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "in_normal_1", {
          priceId: EDITION_PLAN_ID,
          subscriptionId: sub,
        }),
      ),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]);
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, subscriptionCanceled(acct, sub)),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual([]);
  });
});

describe("subscription-payment refund -> coverage-horizon rollback", () => {
  const DAY = 86_400_000;

  test("a refunded subscription payment claws back the paid period's coverage horizon, idempotently", async () => {
    const acct = "acct_sub_refund";
    const sub = "sub_refund_dev";
    // The buyer OWNS compliance via a one_time purchase — backdated two years so the one_time
    // window is long lapsed and the subscription coverage horizon is the BINDING bound.
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_owned",
        source: { kind: "one_time", purchaseId: "pay_owned" },
      }),
    );
    await tp.query(
      `UPDATE entitlement_grant SET granted_at = now() - interval '2 years' WHERE account_id = $1`,
      [acct],
    );
    // A Developer (covers-owned) granting invoice stamps the coverage horizon (now + 1 month).
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "txn_sub_pay_1", { subscriptionId: sub }),
      ),
    );
    const before = await withTenant(tp.pg, acct, (tx) =>
      computeUpdatesWindows(tx, acct),
    );
    const beforeMs = new Date(before["compliance"] ?? "").getTime();
    // Covered: the bound extends WELL past the lapsed own-window (>= ~1 month out).
    expect(beforeMs).toBeGreaterThan(Date.now() + 20 * DAY);

    // Refund THAT subscription payment (a whole-transaction refund of the invoice's txn id).
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, refundCompleted(acct, "txn_sub_pay_1")),
    );
    const after = await withTenant(tp.pg, acct, (tx) =>
      computeUpdatesWindows(tx, acct),
    );
    const afterMs = new Date(after["compliance"] ?? "").getTime();
    // The horizon rolled back by the refunded period: the previously-covered id has lost its
    // subscription-sourced coverage (the bound is back to ~now, not a month out; +/- calendar
    // month arithmetic tolerance).
    expect(afterMs).toBeLessThan(beforeMs - 20 * DAY);
    expect(Math.abs(afterMs - Date.now())).toBeLessThan(5 * DAY);

    // The credits the refunded invoice granted were clawed too (the pre-existing claw path
    // keys on the same payment id).
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(0);

    // Redelivery: the order-row latch already flipped, so nothing double-shrinks.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, refundCompleted(acct, "txn_sub_pay_1")),
    );
    const again = await withTenant(tp.pg, acct, (tx) =>
      computeUpdatesWindows(tx, acct),
    );
    expect(again["compliance"]).toBe(after["compliance"]);
  });

  test("a one-time purchase refund never trips the subscription rollback (no subscription order row)", async () => {
    const acct = "acct_onetime_refund_notrip";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompleted(acct, "pay_nt_1", ONETIME_EDITION_ID),
      ),
    );
    // The refund runs the whole-transaction branch; the subscription latch matches no row and
    // the existing one_time revoke semantics are unchanged.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, refundCompleted(acct, "pay_nt_1")),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual([]);
  });

  test("refunding a canceled-before-grant late invoice rolls back NO horizon (it stamped none); its credits still claw", async () => {
    const acct = "acct_tomb_refund";
    const sub = "sub_tomb_refund";
    // Owned one_time compliance, backdated so the subscription coverage horizon is the binding
    // bound (same setup as the rollback test above).
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_tomb_owned",
        source: { kind: "one_time", purchaseId: "pay_tomb_owned" },
      }),
    );
    await tp.query(
      `UPDATE entitlement_grant SET granted_at = now() - interval '2 years' WHERE account_id = $1`,
      [acct],
    );
    // Invoice 1 stamps the horizon (now + 1 month), then the subscription cancels.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "txn_tomb_pay_1", { subscriptionId: sub }),
      ),
    );
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, subscriptionCanceled(acct, sub)),
    );
    // The horizon is grandfathered across the cancel (a paid fact) — capture it as the baseline.
    const before = await withTenant(tp.pg, acct, (tx) =>
      computeUpdatesWindows(tx, acct),
    );
    expect(new Date(before["compliance"] ?? "").getTime()).toBeGreaterThan(
      Date.now() + 20 * DAY,
    );
    // A LATE out-of-order invoice lands after the cancel: credits only, NO horizon stamp — and
    // its order row records exactly that (coverage_stamped = false, subscription_id carried).
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "txn_tomb_pay_2", { subscriptionId: sub }),
      ),
    );
    const rows = await tp.query<{
      source_event_id: string;
      subscription_id: string | null;
      coverage_stamped: boolean;
    }>(
      `SELECT source_event_id, subscription_id, coverage_stamped FROM order_record
        WHERE account_id = $1 AND kind = 'subscription' ORDER BY source_event_id`,
      [acct],
    );
    expect(rows).toEqual([
      {
        source_event_id: "txn_tomb_pay_1",
        subscription_id: sub,
        coverage_stamped: true,
      },
      {
        source_event_id: "txn_tomb_pay_2",
        subscription_id: sub,
        coverage_stamped: false,
      },
    ]);
    const balBefore = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    // Refund the LATE invoice: the horizon it never stamped must not shrink — without the
    // coverage_stamped gate this refund would claw a period invoice 1's un-refunded payment
    // paid for. The late invoice's own credits still claw (same payment id).
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, refundCompleted(acct, "txn_tomb_pay_2")),
    );
    const after = await withTenant(tp.pg, acct, (tx) =>
      computeUpdatesWindows(tx, acct),
    );
    expect(after["compliance"]).toBe(before["compliance"]);
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(
      balBefore - 1000, // the late invoice's own Developer-cycle grant, clawed by payment id
    );
  });

  test("after a cancel + re-subscribe on the SAME price, refunding the OLD subscription's invoice claws the OLD rows only", async () => {
    const acct = "acct_resub_refund";
    const subA = "sub_resub_old";
    const subB = "sub_resub_live";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_resub_owned",
        source: { kind: "one_time", purchaseId: "pay_resub_owned" },
      }),
    );
    await tp.query(
      `UPDATE entitlement_grant SET granted_at = now() - interval '2 years' WHERE account_id = $1`,
      [acct],
    );
    // Subscription A grants (stamps its horizon), then cancels; the buyer re-subscribes to the
    // SAME plan/price as subscription B, which stamps its own horizon. Two subscription_status
    // rows now share one price id — the exact ambiguity a by-price claw target would trip over.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "txn_resub_a_1", { subscriptionId: subA }),
      ),
    );
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, subscriptionCanceled(acct, subA)),
    );
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        invoicePaid(acct, "txn_resub_b_1", { subscriptionId: subB }),
      ),
    );
    // Refund the OLD subscription's invoice: A's rows shrink, B's — the subscription the buyer
    // is still paying for — keep their full horizon.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, refundCompleted(acct, "txn_resub_a_1")),
    );
    const grants = await tp.query<{
      subscription_id: string | null;
      updates_expires_at: string | Date | null;
    }>(
      `SELECT subscription_id, updates_expires_at FROM entitlement_grant
        WHERE account_id = $1 AND source_kind = 'subscription'`,
      [acct],
    );
    const horizonMs = (v: string | Date | null): number =>
      new Date(v ?? "").getTime();
    const aRows = grants.filter((r) => r.subscription_id === subA);
    const bRows = grants.filter((r) => r.subscription_id === subB);
    expect(aRows.length).toBeGreaterThan(0);
    expect(bRows.length).toBeGreaterThan(0);
    for (const r of aRows) {
      // A's stamped month was clawed — its horizon is back to ~now.
      expect(
        Math.abs(horizonMs(r.updates_expires_at) - Date.now()),
      ).toBeLessThan(5 * DAY);
    }
    for (const r of bRows) {
      // B untouched — still ~a month out.
      expect(horizonMs(r.updates_expires_at)).toBeGreaterThan(
        Date.now() + 20 * DAY,
      );
    }
    // The fold still reads B's live coverage: the buyer-visible window survives the old refund.
    const windows = await withTenant(tp.pg, acct, (tx) =>
      computeUpdatesWindows(tx, acct),
    );
    expect(new Date(windows["compliance"] ?? "").getTime()).toBeGreaterThan(
      Date.now() + 20 * DAY,
    );
  });
});

describe("ADR-0315 affiliate attribution — discountId stamped on order_record end to end", () => {
  /** The stamped discount_id for an order (superuser read — bypasses order_record RLS). */
  async function stampedDiscount(
    sourceEventId: string,
    kind: "purchase" | "subscription",
  ): Promise<string | null> {
    const rows = await tp.query<{ discount_id: string | null }>(
      `SELECT discount_id FROM order_record WHERE source_event_id = $1 AND kind = $2`,
      [sourceEventId, kind],
    );
    return rows[0]?.discount_id ?? null;
  }

  test("a one-time purchase.completed carrying discountId stamps order_record.discount_id", async () => {
    const acct = "acct_aff_purchase";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, {
        type: "purchase.completed",
        sourceEventId: "evt_aff_p",
        accountId: acct,
        amountTotal: 129900,
        currency: "usd",
        lineItems: [
          {
            priceId: ONETIME_EDITION_ID,
            quantity: 1,
            itemId: "",
            chargedAmount: 0,
          },
        ],
        paymentId: "pay_aff_p",
        discountId: "dsc_apply_p",
      }),
    );
    expect(await stampedDiscount("pay_aff_p", "purchase")).toBe("dsc_apply_p");
  });

  test("a subscription invoice.paid carrying discountId stamps order_record.discount_id", async () => {
    const acct = "acct_aff_sub";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, {
        type: "invoice.paid",
        sourceEventId: "evt_in_aff_s",
        accountId: acct,
        amountTotal: 9900,
        currency: "usd",
        subscriptionId: "sub_aff_s",
        priceId: PLAN_ID,
        billingReason: "subscription_cycle",
        invoiceId: "in_aff_s",
        discountId: "dsc_apply_s",
      }),
    );
    expect(await stampedDiscount("in_aff_s", "subscription")).toBe(
      "dsc_apply_s",
    );
  });

  test("a purchase WITHOUT a discountId leaves order_record.discount_id NULL (regression)", async () => {
    const acct = "acct_aff_none";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompleted(acct, "pay_aff_none", ONETIME_EDITION_ID),
      ),
    );
    expect(await stampedDiscount("pay_aff_none", "purchase")).toBeNull();
  });

  test("a refund of an attributed purchase flips the row → the report flags it as a clawback", async () => {
    const acct = "acct_aff_refund";
    await insertAffiliateCode(tp.pg as unknown as TenantExecutor, {
      code: "AFFREFUND",
      discountId: "dsc_apply_refund",
      affiliateName: "Refund Affiliate",
      createdBy: "op",
    });
    // A discounted one-time purchase (8910¢ charged) redeeming the affiliate's code.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, {
        type: "purchase.completed",
        sourceEventId: "evt_aff_refund",
        accountId: acct,
        amountTotal: 8910,
        currency: "usd",
        lineItems: [
          {
            priceId: ONETIME_EDITION_ID,
            quantity: 1,
            itemId: "",
            chargedAmount: 8910,
          },
        ],
        paymentId: "pay_aff_refund",
        discountId: "dsc_apply_refund",
      }),
    );
    // Before the refund: payable commission = floor(8910 * 3000 / 10000) = 2673, no clawback.
    let rep = await readAffiliateReport(tp.pg as unknown as TenantExecutor);
    let entry = rep.affiliates.find((a) => a.discountId === "dsc_apply_refund");
    expect(entry?.commissionCents).toBe(2673);
    expect(entry?.clawbackCents).toBe(0);

    // A whole-transaction refund flips the order row to 'refunded'.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, refundCompleted(acct, "pay_aff_refund", true)),
    );
    rep = await readAffiliateReport(tp.pg as unknown as TenantExecutor);
    entry = rep.affiliates.find((a) => a.discountId === "dsc_apply_refund");
    // Now the sale is a clawback ALERT: payable commission drops to 0, the clawback surfaces 2673.
    expect(entry?.commissionCents).toBe(0);
    expect(entry?.clawbackCents).toBe(2673);
    expect(
      entry?.orders.find((o) => o.orderId === "pay_aff_refund")?.clawback,
    ).toBe(true);
  });
});

// ADR-0381 lock 2 — the per-grant paid amount an upgrade quote reads as its credit floor. The
// number was always on the event (`lineItems[].chargedAmount`, minor units); these pin that it is
// persisted when — and only when — it is genuinely a single SKU's price.
describe("entitlement_grant.charged_amount (ADR-0381 lock 2)", () => {
  async function chargedFor(
    accountId: string,
  ): Promise<{ amount: number | null; currency: string | null }[]> {
    return withTenant(tp.pg, accountId, async (tx) => {
      const r = await tx.query<{
        charged_amount: number | null;
        charged_currency: string | null;
      }>(
        `SELECT charged_amount, charged_currency FROM entitlement_grant
         WHERE account_id = $1 ORDER BY entitlement_id`,
        [accountId],
      );
      return r.rows.map((row) => ({
        amount: row.charged_amount,
        currency: row.charged_currency,
      }));
    });
  }

  test("a single-SKU line at quantity 1 records its charge and currency", async () => {
    const acct = "acct_charged_ok";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompletedMulti(acct, "pay_charged_ok", [
          {
            priceId: ONETIME_EDITION_ID,
            quantity: 1,
            itemId: "txnitm_ok",
            chargedAmount: 164900,
          },
        ]),
      ),
    );
    expect(await chargedFor(acct)).toEqual([
      { amount: 164900, currency: "usd" },
    ]);
  });

  test("a quantity-2 line records NOTHING — the total is not the SKU's price", async () => {
    const acct = "acct_charged_qty2";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompletedMulti(acct, "pay_charged_qty2", [
          {
            priceId: ONETIME_EDITION_ID,
            quantity: 2,
            itemId: "txnitm_qty2",
            chargedAmount: 289800,
          },
        ]),
      ),
    );
    // NULL, not 289800 — crediting double the price on a later upgrade is the bug this prevents.
    expect(await chargedFor(acct)).toEqual([{ amount: null, currency: null }]);
  });

  test("a driver with no per-line data (chargedAmount 0) records NOTHING, not free", async () => {
    const acct = "acct_charged_zero";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompletedMulti(acct, "pay_charged_zero", [
          {
            priceId: ONETIME_EDITION_ID,
            quantity: 1,
            itemId: "txnitm_zero",
            chargedAmount: 0,
          },
        ]),
      ),
    );
    expect(await chargedFor(acct)).toEqual([{ amount: null, currency: null }]);
  });

  test("amount and currency are written as a pair, never one without the other", async () => {
    const acct = "acct_charged_pair";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompletedMulti(acct, "pay_charged_pair", [
          {
            priceId: ONETIME_EDITION_ID,
            quantity: 1,
            itemId: "txnitm_pair",
            chargedAmount: 19900,
          },
        ]),
      ),
    );
    for (const row of await chargedFor(acct)) {
      expect(row.amount === null).toBe(row.currency === null);
    }
  });
});

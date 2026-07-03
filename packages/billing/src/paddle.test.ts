// Paddle billing seam (ADR-0108): raw-body HMAC webhook verification + Paddle->domain event mapping.
// Mirrors billing.test.ts's Stripe coverage. Synthetic secrets only — live Paddle creds + a live
// webhook smoke-test are operator/DEPLOY-class, out of scope here.
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, test } from "bun:test";
import { AuthnError, ValidationError } from "@caisson/kernel";
import {
  createPaddleBilling,
  parsePaddleEvent,
  PaddleEventSchema,
  verifyPaddleWebhook,
} from "./index.ts";

const SECRET = "pdl_ntfset_test_secret";
const T = 1_700_000_000;

function signed(body: string, secret = SECRET, t = T): string {
  const sig = createHmac("sha256", secret).update(`${t}:${body}`).digest("hex");
  return `ts=${t};h1=${sig}`;
}

const oneTimeTxnBody = JSON.stringify({
  event_id: "evt_01gks14ge726w50ch2tmaw2a1x",
  event_type: "transaction.completed",
  data: {
    id: "txn_01hvcc93znj3mpqt1tenkjb04y",
    subscription_id: null,
    currency_code: "usd",
    custom_data: { account_id: "acct_a" },
    items: [{ price: { id: "price_credit_pack_PLACEHOLDER" } }],
    details: { totals: { grand_total: "5000" } },
  },
});

describe("Paddle webhook verification", () => {
  test("accepts a valid signature within tolerance", () => {
    expect(() =>
      verifyPaddleWebhook(oneTimeTxnBody, signed(oneTimeTxnBody), SECRET, {
        now: T,
      }),
    ).not.toThrow();
  });

  test("rejects a tampered body", () => {
    const header = signed(oneTimeTxnBody);
    expect(() =>
      verifyPaddleWebhook(`${oneTimeTxnBody} `, header, SECRET, { now: T }),
    ).toThrow(AuthnError);
  });

  test("rejects the wrong secret", () => {
    expect(() =>
      verifyPaddleWebhook(
        oneTimeTxnBody,
        signed(oneTimeTxnBody, "pdl_ntfset_wrong"),
        SECRET,
        { now: T },
      ),
    ).toThrow(AuthnError);
  });

  test("rejects an out-of-tolerance timestamp (replay)", () => {
    expect(() =>
      verifyPaddleWebhook(oneTimeTxnBody, signed(oneTimeTxnBody), SECRET, {
        now: T + 1000,
      }),
    ).toThrow(AuthnError);
  });

  test("rejects a malformed signature header", () => {
    expect(() =>
      verifyPaddleWebhook(oneTimeTxnBody, "garbage", SECRET, { now: T }),
    ).toThrow(AuthnError);
  });
});

describe("event mapping", () => {
  test("a one-time transaction.completed -> purchase.completed", () => {
    const event = JSON.parse(oneTimeTxnBody) as Parameters<
      typeof parsePaddleEvent
    >[0];
    expect(parsePaddleEvent(event)).toEqual({
      type: "purchase.completed",
      sourceEventId: "evt_01gks14ge726w50ch2tmaw2a1x",
      accountId: "acct_a",
      amountTotal: 5000,
      currency: "usd",
      // No `details.line_items` in this fixture → the per-line join fields are the empty sentinels.
      lineItems: [
        {
          priceId: "price_credit_pack_PLACEHOLDER",
          quantity: 1,
          itemId: "",
          chargedAmount: 0,
        },
      ],
      paymentId: "txn_01hvcc93znj3mpqt1tenkjb04y",
    });
  });

  test("a multi-item one-time transaction fulfills EVERY line, with quantity (Strix vuln-0005)", () => {
    // The on-site cart opens ONE multi-line Paddle checkout, so Paddle fires ONE transaction.completed
    // carrying every line in data.items. The pre-fix mapper read only items[0] — the buyer paid for
    // the whole cart and received just the first SKU. All lines (and their quantities) must map, each
    // carrying its own details.line_items join id (a multi-line transaction without per-line ids fails
    // closed — see the credit-uniqueness-collision test below).
    const event = {
      event_id: "evt_cart",
      event_type: "transaction.completed",
      data: {
        id: "txn_cart",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: "acct_a" },
        items: [
          { price: { id: "price_compliance_PLACEHOLDER" }, quantity: 1 },
          { price: { id: "price_credit_pack_PLACEHOLDER" }, quantity: 3 },
        ],
        details: {
          totals: { grand_total: "20000" },
          line_items: [
            {
              id: "txnitm_compliance",
              price_id: "price_compliance_PLACEHOLDER",
              totals: { total: "15000" },
            },
            {
              id: "txnitm_pack",
              price_id: "price_credit_pack_PLACEHOLDER",
              totals: { total: "5000" },
            },
          ],
        },
      },
    } as Parameters<typeof parsePaddleEvent>[0];
    const parsed = parsePaddleEvent(event);
    expect(parsed?.type).toBe("purchase.completed");
    expect(
      parsed?.type === "purchase.completed" ? parsed.lineItems : [],
    ).toEqual([
      {
        priceId: "price_compliance_PLACEHOLDER",
        quantity: 1,
        itemId: "txnitm_compliance",
        chargedAmount: 15000,
      },
      {
        priceId: "price_credit_pack_PLACEHOLDER",
        quantity: 3,
        itemId: "txnitm_pack",
        chargedAmount: 5000,
      },
    ]);
  });

  test("a shuffled details.line_items order still correlates correctly by price_id key (CAISSON-6)", () => {
    // Paddle does not guarantee items[] and details.line_items[] share an index order — only that each
    // line item echoes the price_id it was priced from. The pre-fix positional read would have paired
    // items[0] (compliance) with line_items[0] (the PACK's txnitm_/total, listed here FIRST) — a wrong,
    // silent mis-join. The keyed-by-price_id read must pair each item with the line_items entry that
    // actually carries its own price_id, regardless of array order.
    const event = {
      event_id: "evt_shuffled",
      event_type: "transaction.completed",
      data: {
        id: "txn_shuffled",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: "acct_a" },
        items: [
          { price: { id: "price_compliance_PLACEHOLDER" }, quantity: 1 },
          { price: { id: "price_credit_pack_PLACEHOLDER" }, quantity: 3 },
        ],
        details: {
          totals: { grand_total: "20000" },
          // Reversed relative to items[] above.
          line_items: [
            {
              id: "txnitm_pack",
              price_id: "price_credit_pack_PLACEHOLDER",
              totals: { total: "5000" },
            },
            {
              id: "txnitm_compliance",
              price_id: "price_compliance_PLACEHOLDER",
              totals: { total: "15000" },
            },
          ],
        },
      },
    } as Parameters<typeof parsePaddleEvent>[0];
    const parsed = parsePaddleEvent(event);
    expect(parsed?.type).toBe("purchase.completed");
    expect(
      parsed?.type === "purchase.completed" ? parsed.lineItems : [],
    ).toEqual([
      {
        priceId: "price_compliance_PLACEHOLDER",
        quantity: 1,
        itemId: "txnitm_compliance", // correctly paired despite line_items[] being reversed
        chargedAmount: 15000,
      },
      {
        priceId: "price_credit_pack_PLACEHOLDER",
        quantity: 3,
        itemId: "txnitm_pack",
        chargedAmount: 5000,
      },
    ]);
  });

  test("a multi-line transaction missing per-line join ids fails closed, not a silent under-grant (credit uniqueness collision)", () => {
    // Two credit-bearing lines with no details.line_items both read the "" itemId sentinel. Granting
    // them would collide on the credit ledger's (source_event_id, event_type, COALESCE(line_item_id,''))
    // uniqueness key — the second line hits ON CONFLICT DO NOTHING and is silently dropped while the
    // webhook acks 200, permanently under-granting a cart the buyer paid for in full. The mapper must
    // THROW so verifyAndParse returns a non-2xx and Paddle redelivers.
    const event = {
      event_id: "evt_cart_no_details",
      event_type: "transaction.completed",
      data: {
        id: "txn_cart_no_details",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: "acct_a" },
        items: [
          { price: { id: "price_credit_pack_PLACEHOLDER" }, quantity: 1 },
          { price: { id: "price_credit_pack_PLACEHOLDER" }, quantity: 2 },
        ],
        // No details.line_items → both lines correlate to the "" join-id sentinel.
        details: { totals: { grand_total: "15000" } },
      },
    } as Parameters<typeof parsePaddleEvent>[0];
    expect(() => parsePaddleEvent(event)).toThrow(/per-line join id/);
  });

  test("a SINGLE-line transaction with the empty join-id sentinel still grants (no collision possible)", () => {
    // One line cannot collide on the per-line uniqueness key, so the "" sentinel stays allowed — the
    // common no-details.line_items one-SKU buy maps to a normal purchase.completed, never failing closed.
    const event = JSON.parse(oneTimeTxnBody) as Parameters<
      typeof parsePaddleEvent
    >[0];
    const parsed = parsePaddleEvent(event);
    expect(parsed?.type).toBe("purchase.completed");
    expect(
      parsed?.type === "purchase.completed" ? parsed.lineItems[0]?.itemId : "x",
    ).toBe("");
  });

  test("a multi-item transaction with one MALFORMED line fails closed, not a partial grant (Greptile P1)", () => {
    // One line is unreadable (no price id). Silently skipping it would ack the webhook and grant the
    // buyer only the valid line — a permanent under-grant with no Paddle retry. The mapper must THROW so
    // verifyAndParse returns a non-2xx and Paddle redelivers.
    const event = {
      event_id: "evt_cart_bad",
      event_type: "transaction.completed",
      data: {
        id: "txn_cart_bad",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: "acct_a" },
        items: [
          { price: { id: "price_compliance_PLACEHOLDER" }, quantity: 1 },
          { price: {} }, // malformed: no price id
        ],
        details: { totals: { grand_total: "20000" } },
      },
    } as Parameters<typeof parsePaddleEvent>[0];
    expect(() => parsePaddleEvent(event)).toThrow(/price id/);
  });

  test("a subscription-linked transaction.completed never maps to purchase.completed (ADR-0108 guard)", () => {
    // Paddle fires the SAME event for the subscription's first charge and every renewal — unlike
    // Stripe's separate checkout.session.completed/invoice.paid split. Mirrors the Stripe driver's
    // subscription-mode guard: this must never become a one-time purchase.completed. The first
    // charge from a Paddle.js checkout carries origin "web" (verified 2026-07-01: no origin value
    // means "first subscription charge" — subscription_charge is a MID-CYCLE one-time charge).
    const event = {
      event_id: "evt_sub_first",
      event_type: "transaction.completed",
      data: {
        id: "txn_sub1",
        subscription_id: "sub_01gks14ge726w50ch2tmaw2a1x",
        origin: "web",
        currency_code: "usd",
        custom_data: { account_id: "acct_a" },
        items: [
          { price: { id: "price_compliance_updates_annual_PLACEHOLDER" } },
        ],
        details: { totals: { grand_total: "1290000" } },
      },
    } as Parameters<typeof parsePaddleEvent>[0];
    const parsed = parsePaddleEvent(event);
    expect(parsed?.type).not.toBe("purchase.completed");
    expect(parsed).toEqual({
      type: "invoice.paid",
      sourceEventId: "evt_sub_first",
      accountId: "acct_a",
      amountTotal: 1290000,
      currency: "usd",
      subscriptionId: "sub_01gks14ge726w50ch2tmaw2a1x",
      priceId: "price_compliance_updates_annual_PLACEHOLDER",
      billingReason: "subscription_create",
      invoiceId: "txn_sub1",
    });
  });

  test("a mid-cycle subscription_charge transaction stays NON-granting (no cycle allotment)", () => {
    // origin "subscription_charge" = a one-time charge FOR a subscription (addon/topup), NOT the
    // first charge (verified 2026-07-01). It must pass through as a reason outside the grant gate's
    // GRANTING_REASONS — mapping it to subscription_create would over-grant a full cycle allotment.
    const event = {
      event_id: "evt_sub_midcycle",
      event_type: "transaction.completed",
      data: {
        id: "txn_sub_mid",
        subscription_id: "sub_x",
        origin: "subscription_charge",
        currency_code: "usd",
        custom_data: { account_id: "acct_a" },
        items: [
          { price: { id: "price_compliance_updates_annual_PLACEHOLDER" } },
        ],
        details: { totals: { grand_total: "5000" } },
      },
    } as Parameters<typeof parsePaddleEvent>[0];
    const parsed = parsePaddleEvent(event);
    expect(parsed?.type).toBe("invoice.paid");
    expect(parsed?.type === "invoice.paid" ? parsed.billingReason : "").toBe(
      "subscription_charge",
    );
  });

  test("a subscription_update (proration) transaction stays NON-granting (Strix vuln-0002)", () => {
    // origin "subscription_update" = a proration/plan-change transaction, NOT a chargeable renewal.
    // It must pass through as its raw origin (outside GRANTING_REASONS) so no cycle allotment grants
    // until the next real renewal invoice (ADR-0089 SD-1). The pre-fix mapper's inverted allowlist
    // ("everything except subscription_charge → subscription_cycle") granted a full cycle here — the
    // exact bug Strix vuln-0002's PoC hit (a signed subscription_update credited 1000). This locks the
    // corrected allowlist mapping so a regression back to a default-granting else-branch fails here.
    const event = {
      event_id: "evt_sub_update",
      event_type: "transaction.completed",
      data: {
        id: "txn_sub_upd",
        subscription_id: "sub_x",
        origin: "subscription_update",
        currency_code: "usd",
        custom_data: { account_id: "acct_a" },
        items: [
          { price: { id: "price_compliance_updates_annual_PLACEHOLDER" } },
        ],
        details: { totals: { grand_total: "1290000" } },
      },
    } as Parameters<typeof parsePaddleEvent>[0];
    const parsed = parsePaddleEvent(event);
    expect(parsed?.type).toBe("invoice.paid");
    expect(parsed?.type === "invoice.paid" ? parsed.billingReason : "").toBe(
      "subscription_update",
    );
  });

  test("a subscription renewal transaction.completed maps billingReason=subscription_cycle", () => {
    const event = {
      event_id: "evt_sub_renew",
      event_type: "transaction.completed",
      data: {
        id: "txn_sub2",
        subscription_id: "sub_x",
        origin: "subscription_recurring",
        currency_code: "usd",
        custom_data: { account_id: "acct_a" },
        items: [
          { price: { id: "price_compliance_updates_annual_PLACEHOLDER" } },
        ],
        details: { totals: { grand_total: "1290000" } },
      },
    } as Parameters<typeof parsePaddleEvent>[0];
    const parsed = parsePaddleEvent(event);
    expect(parsed?.type).toBe("invoice.paid");
    expect(parsed && "billingReason" in parsed && parsed.billingReason).toBe(
      "subscription_cycle",
    );
  });

  test("the subscription-mode guard returns null when the transaction carries no anchoring id", () => {
    // A degenerate subscription-linked transaction.completed (no transaction id) has nothing to key a
    // grant's idempotency on; the guard returns null rather than risk a malformed grant — mirrors the
    // Stripe driver's defensive shape for its subscription-mode guard.
    const event = {
      event_id: "evt_degenerate",
      event_type: "transaction.completed",
      data: {
        id: "",
        subscription_id: "sub_x",
        custom_data: { account_id: "acct_a" },
      },
    } as Parameters<typeof parsePaddleEvent>[0];
    expect(parsePaddleEvent(event)).toBeNull();
  });

  test("subscription.canceled carries the subscription id", () => {
    const event = {
      event_id: "evt_del",
      event_type: "subscription.canceled",
      data: { id: "sub_gone", custom_data: { account_id: "acct_a" } },
    } as Parameters<typeof parsePaddleEvent>[0];
    expect(parsePaddleEvent(event)).toEqual({
      type: "subscription.canceled",
      sourceEventId: "evt_del",
      accountId: "acct_a",
      subscriptionId: "sub_gone",
    });
  });

  test("an approved refund adjustment -> refund.completed joins on the transaction id", () => {
    const event = {
      event_id: "evt_ref",
      event_type: "adjustment.updated",
      data: {
        action: "refund",
        status: "approved",
        type: "full",
        transaction_id: "txn_01hvcc93znj3mpqt1tenkjb04y",
        currency_code: "usd",
        custom_data: { account_id: "acct_a" },
        totals: { total: "5000" },
      },
    } as Parameters<typeof parsePaddleEvent>[0];
    expect(parsePaddleEvent(event)).toEqual({
      type: "refund.completed",
      sourceEventId: "evt_ref",
      accountId: "acct_a",
      paymentId: "txn_01hvcc93znj3mpqt1tenkjb04y",
      amountRefunded: 5000,
      currency: "usd",
      fullyRefunded: true,
      // No adjustment `id` in this fixture → ""; a whole-transaction full refund carries no per-line
      // items (it revokes/claws by transaction id).
      adjustmentId: "",
      items: [],
    });
  });

  test("a PARTIAL approved refund maps with fullyRefunded=false", () => {
    const event = {
      event_id: "evt_partial",
      event_type: "adjustment.updated",
      data: {
        action: "refund",
        status: "approved",
        type: "partial",
        transaction_id: "txn_x",
        currency_code: "usd",
        custom_data: { account_id: "acct_a" },
        totals: { total: "100" },
      },
    } as Parameters<typeof parsePaddleEvent>[0];
    const parsed = parsePaddleEvent(event);
    expect(parsed?.type).toBe("refund.completed");
    expect(parsed && "fullyRefunded" in parsed && parsed.fullyRefunded).toBe(
      false,
    );
  });

  test("a one-time transaction captures each line's txnitm_ id + charged total from details.line_items (ADR-0218)", () => {
    // The `txnitm_…` join key + per-line charged total live on `details.line_items[]`, NOT the
    // request-echo `items[]`. The mapper correlates the two arrays by their shared `price_id`
    // (CAISSON-6) so a later per-line adjustment refund can join back on the item id and proportion
    // against the charged amount.
    const event = {
      event_id: "evt_join",
      event_type: "transaction.completed",
      data: {
        id: "txn_join",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: "acct_a" },
        items: [
          { price: { id: "price_compliance_PLACEHOLDER" }, quantity: 1 },
          { price: { id: "price_credit_pack_PLACEHOLDER" }, quantity: 1 },
        ],
        details: {
          totals: { grand_total: "20000" },
          line_items: [
            {
              id: "txnitm_compliance",
              price_id: "price_compliance_PLACEHOLDER",
              totals: { total: "15000" },
            },
            {
              id: "txnitm_pack",
              price_id: "price_credit_pack_PLACEHOLDER",
              totals: { total: "5000" },
            },
          ],
        },
      },
    } as Parameters<typeof parsePaddleEvent>[0];
    const parsed = parsePaddleEvent(event);
    expect(
      parsed?.type === "purchase.completed" ? parsed.lineItems : [],
    ).toEqual([
      {
        priceId: "price_compliance_PLACEHOLDER",
        quantity: 1,
        itemId: "txnitm_compliance",
        chargedAmount: 15000,
      },
      {
        priceId: "price_credit_pack_PLACEHOLDER",
        quantity: 1,
        itemId: "txnitm_pack",
        chargedAmount: 5000,
      },
    ]);
  });

  test("a captured txnitm_ id equals the item_id a later per-line adjustment refunds (ADR-0218 round-trip)", () => {
    // The mitigation for the `item_id` source-correctness risk: the id captured at grant time
    // (`details.line_items[].id`) must be the SAME id a refund adjustment carries (`data.items[].item_id`)
    // — else the join never resolves and a per-line refund silently claws nothing.
    const purchase = parsePaddleEvent({
      event_id: "evt_p",
      event_type: "transaction.completed",
      data: {
        id: "txn_rt",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: "acct_a" },
        items: [
          { price: { id: "price_credit_pack_PLACEHOLDER" }, quantity: 1 },
        ],
        details: {
          totals: { grand_total: "5000" },
          line_items: [
            {
              id: "txnitm_pack",
              price_id: "price_credit_pack_PLACEHOLDER",
              totals: { total: "5000" },
            },
          ],
        },
      },
    } as Parameters<typeof parsePaddleEvent>[0]);
    const capturedId =
      purchase?.type === "purchase.completed"
        ? purchase.lineItems[0]?.itemId
        : "";
    const refund = parsePaddleEvent({
      event_id: "evt_r",
      event_type: "adjustment.updated",
      data: {
        id: "adj_rt",
        action: "refund",
        status: "approved",
        type: "partial",
        transaction_id: "txn_rt",
        currency_code: "usd",
        custom_data: { account_id: "acct_a" },
        totals: { total: "5000" },
        items: [
          {
            id: "adjitm_1",
            item_id: "txnitm_pack",
            type: "full",
            totals: { total: "5000" },
          },
        ],
      },
    } as Parameters<typeof parsePaddleEvent>[0]);
    const refundedId =
      refund?.type === "refund.completed" ? refund.items[0]?.itemId : "";
    expect(capturedId).toBe("txnitm_pack");
    expect(refundedId).toBe(capturedId);
  });

  test("a partial adjustment parses per-line items, skipping tax/proration (ADR-0218)", () => {
    const event = {
      event_id: "evt_partial_items",
      event_type: "adjustment.updated",
      data: {
        id: "adj_1",
        action: "refund",
        status: "approved",
        type: "partial",
        transaction_id: "txn_x",
        currency_code: "usd",
        custom_data: { account_id: "acct_a" },
        totals: { total: "5000" },
        items: [
          {
            id: "adjitm_1",
            item_id: "txnitm_a",
            type: "full",
            totals: { total: "3000" },
          },
          {
            id: "adjitm_2",
            item_id: "txnitm_b",
            type: "partial",
            totals: { total: "2000" },
          },
          // Paddle-generated tax item — NOT an operator-initiated line refund; must be skipped.
          {
            id: "adjitm_3",
            item_id: "txnitm_tax",
            type: "tax",
            totals: { total: "500" },
          },
        ],
      },
    } as Parameters<typeof parsePaddleEvent>[0];
    const parsed = parsePaddleEvent(event);
    expect(parsed?.type).toBe("refund.completed");
    if (parsed?.type === "refund.completed") {
      expect(parsed.fullyRefunded).toBe(false);
      expect(parsed.adjustmentId).toBe("adj_1");
      expect(parsed.items).toEqual([
        { itemId: "txnitm_a", amountRefunded: 3000, fullyRefunded: true },
        { itemId: "txnitm_b", amountRefunded: 2000, fullyRefunded: false },
      ]);
    }
  });

  test("a multi-line transaction with a DUPLICATE non-empty join id fails closed (CAISSON-8)", () => {
    // Two lines sharing the SAME real txnitm_ id collide on the credit ledger's per-line uniqueness
    // key exactly like the "" sentinel collision above — the second line silently no-ops while the
    // webhook still acks 200. The mapper must throw so verifyAndParse returns a non-2xx and Paddle
    // redelivers.
    const event = {
      event_id: "evt_dup_join",
      event_type: "transaction.completed",
      data: {
        id: "txn_dup_join",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: "acct_a" },
        items: [
          { price: { id: "price_compliance_PLACEHOLDER" }, quantity: 1 },
          { price: { id: "price_credit_pack_PLACEHOLDER" }, quantity: 1 },
        ],
        details: {
          totals: { grand_total: "20000" },
          line_items: [
            {
              id: "txnitm_dup",
              price_id: "price_compliance_PLACEHOLDER",
              totals: { total: "15000" },
            },
            {
              id: "txnitm_dup", // same join id as the line above — malformed delivery
              price_id: "price_credit_pack_PLACEHOLDER",
              totals: { total: "5000" },
            },
          ],
        },
      },
    } as Parameters<typeof parsePaddleEvent>[0];
    expect(() => parsePaddleEvent(event)).toThrow(/duplicate per-line join id/);
  });

  test("a malformed adjustment item signals onWarn but still SKIPS it, never throwing (CAISSON-7)", () => {
    const warnings: string[] = [];
    const event = {
      event_id: "evt_partial_malformed",
      event_type: "adjustment.updated",
      data: {
        id: "adj_bad",
        action: "refund",
        status: "approved",
        type: "partial",
        transaction_id: "txn_x",
        currency_code: "usd",
        custom_data: { account_id: "acct_a" },
        totals: { total: "5000" },
        items: [
          {
            id: "adjitm_1",
            item_id: "txnitm_a",
            type: "full",
            totals: { total: "3000" },
          },
          "not an object", // malformed
          { id: "adjitm_2", type: "partial", totals: { total: "2000" } }, // missing item_id
        ],
      },
    } as Parameters<typeof parsePaddleEvent>[0];
    const parsed = parsePaddleEvent(event, (message) => warnings.push(message));
    expect(parsed?.type).toBe("refund.completed");
    if (parsed?.type === "refund.completed") {
      // Skip behavior is unchanged: only the one well-formed item lands.
      expect(parsed.items).toEqual([
        { itemId: "txnitm_a", amountRefunded: 3000, fullyRefunded: true },
      ]);
    }
    // Both malformed entries fired the warning signal — never a console.log, never a throw.
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/not an object/);
    expect(warnings[1]).toMatch(/item_id/);
  });

  test("a well-formed partial adjustment emits no warnings (onWarn is opt-in noise-free)", () => {
    const warnings: string[] = [];
    const event = {
      event_id: "evt_partial_clean",
      event_type: "adjustment.updated",
      data: {
        id: "adj_clean",
        action: "refund",
        status: "approved",
        type: "partial",
        transaction_id: "txn_x",
        currency_code: "usd",
        custom_data: { account_id: "acct_a" },
        totals: { total: "3000" },
        items: [
          {
            id: "adjitm_1",
            item_id: "txnitm_a",
            type: "full",
            totals: { total: "3000" },
          },
          // A Paddle-generated tax item is an EXPECTED skip, not an anomaly — no warning.
          {
            id: "adjitm_2",
            item_id: "txnitm_tax",
            type: "tax",
            totals: { total: "500" },
          },
        ],
      },
    } as Parameters<typeof parsePaddleEvent>[0];
    parsePaddleEvent(event, (message) => warnings.push(message));
    expect(warnings).toHaveLength(0);
  });

  test("a pending_approval refund is a no-op (not yet settled)", () => {
    const event = {
      event_id: "evt_pending",
      event_type: "adjustment.updated",
      data: {
        action: "refund",
        status: "pending_approval",
        type: "full",
        transaction_id: "txn_x",
        custom_data: { account_id: "acct_a" },
        totals: { total: "100" },
      },
    } as Parameters<typeof parsePaddleEvent>[0];
    expect(parsePaddleEvent(event)).toBeNull();
  });

  test("a credit adjustment (not a refund) is a no-op", () => {
    const event = {
      event_id: "evt_credit",
      event_type: "adjustment.updated",
      data: {
        action: "credit",
        status: "approved",
        type: "full",
        transaction_id: "txn_x",
        custom_data: { account_id: "acct_a" },
        totals: { total: "100" },
      },
    } as Parameters<typeof parsePaddleEvent>[0];
    expect(parsePaddleEvent(event)).toBeNull();
  });

  test("an unhandled event type maps to null", () => {
    expect(
      parsePaddleEvent({
        event_id: "evt_x",
        event_type: "customer.created",
        data: {},
      }),
    ).toBeNull();
  });

  test("verifyAndParse ties verification + mapping behind the port", () => {
    const billing = createPaddleBilling({
      webhookSecret: SECRET,
      apiKey: "pdl_sdbx_test",
    });
    const out = billing.verifyAndParse(oneTimeTxnBody, signed(oneTimeTxnBody), {
      now: T,
    });
    expect(out).toMatchObject({
      type: "purchase.completed",
      accountId: "acct_a",
    });
  });

  test("verifyAndParse threads a configured onWarn to the mapper for a malformed adjustment item (CAISSON-7)", () => {
    // The MUST-FIX gap this pins: onWarn previously had no production path from a signed webhook
    // delivery to parsePaddleEvent — createPaddleBilling built the event with no way to pass one, so
    // wiring it only on PaddleConfig (not exercising verifyAndParse end to end) would not have caught
    // the missing thread-through.
    const warnings: string[] = [];
    const body = JSON.stringify({
      event_id: "evt_provider_warn",
      event_type: "adjustment.updated",
      data: {
        id: "adj_provider",
        action: "refund",
        status: "approved",
        type: "partial",
        transaction_id: "txn_x",
        currency_code: "usd",
        custom_data: { account_id: "acct_a" },
        totals: { total: "3000" },
        items: [
          {
            id: "adjitm_1",
            item_id: "txnitm_a",
            type: "full",
            totals: { total: "3000" },
          },
          "not an object", // malformed
        ],
      },
    });
    const billing = createPaddleBilling({
      webhookSecret: SECRET,
      apiKey: "pdl_sdbx_test",
      onWarn: (message) => warnings.push(message),
    });
    const out = billing.verifyAndParse(body, signed(body), { now: T });
    expect(out?.type).toBe("refund.completed");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/not an object/);
  });
});

describe("PaddleEventSchema (envelope boundary validation, services-hardening MED)", () => {
  test("accepts a well-formed envelope", () => {
    const result = PaddleEventSchema.safeParse({
      event_id: "evt_x",
      event_type: "transaction.completed",
      data: { id: "txn_1" },
    });
    expect(result.success).toBe(true);
  });

  test("rejects an envelope with an unexpected extra top-level field", () => {
    const result = PaddleEventSchema.safeParse({
      event_id: "evt_x",
      event_type: "transaction.completed",
      data: {},
      occurred_at: "2026-01-01T00:00:00Z", // not a declared envelope field
    });
    expect(result.success).toBe(false);
  });

  test("rejects an envelope missing event_id or with the wrong shape", () => {
    expect(
      PaddleEventSchema.safeParse({ event_type: "x", data: {} }).success,
    ).toBe(false);
    expect(
      PaddleEventSchema.safeParse({
        event_id: 123,
        event_type: "x",
        data: {},
      }).success,
    ).toBe(false);
  });

  test("verifyAndParse rejects a signed body carrying an unexpected extra top-level field", () => {
    // The signature is valid (verifyPaddleWebhook passes) — this proves the NEW schema boundary
    // rejects a malformed envelope even when authenticity already checked out; a signature alone
    // never guaranteed the payload shape.
    const extraFieldBody = JSON.stringify({
      event_id: "evt_extra",
      event_type: "transaction.completed",
      occurred_at: "2026-01-01T00:00:00Z",
      data: {
        id: "txn_extra",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: "acct_a" },
        items: [{ price: { id: "price_credit_pack_PLACEHOLDER" } }],
        details: { totals: { grand_total: "5000" } },
      },
    });
    const billing = createPaddleBilling({
      webhookSecret: SECRET,
      apiKey: "pdl_sdbx_test",
    });
    expect(() =>
      billing.verifyAndParse(extraFieldBody, signed(extraFieldBody), {
        now: T,
      }),
    ).toThrow(ValidationError);
  });
});

describe("createCheckout — Paddle transaction-based hosted checkout", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("posts items + custom_data and returns the checkout.url", async () => {
    let body = "";
    let url = "";
    globalThis.fetch = (async (reqUrl: unknown, init?: { body?: string }) => {
      url = String(reqUrl);
      body = init?.body ?? "";
      return new Response(
        JSON.stringify({
          data: { checkout: { url: "https://paddle.test/c" } },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    const billing = createPaddleBilling({
      webhookSecret: SECRET,
      apiKey: "pdl_sdbx_test",
      env: "sandbox",
    });
    const result = await billing.createCheckout({
      accountId: "acct_a",
      priceId: "price_x",
      mode: "payment",
      successUrl: "https://app.test/ok",
      cancelUrl: "https://app.test/no",
    });
    expect(result.url).toBe("https://paddle.test/c");
    expect(url).toBe("https://sandbox-api.paddle.com/transactions");
    const parsed = JSON.parse(body) as {
      items: Array<{ price_id: string; quantity: number }>;
      custom_data: { account_id: string };
    };
    expect(parsed.items).toEqual([{ price_id: "price_x", quantity: 1 }]);
    expect(parsed.custom_data.account_id).toBe("acct_a");
  });

  test("throws when Paddle returns no checkout url", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ data: {} }), {
        status: 200,
      })) as unknown as typeof fetch;
    const billing = createPaddleBilling({
      webhookSecret: SECRET,
      apiKey: "pdl_sdbx_test",
    });
    await expect(
      billing.createCheckout({
        accountId: "acct_a",
        priceId: "price_x",
        mode: "payment",
        successUrl: "https://app.test/ok",
        cancelUrl: "https://app.test/no",
      }),
    ).rejects.toThrow("Paddle returned no checkout url");
  });
});

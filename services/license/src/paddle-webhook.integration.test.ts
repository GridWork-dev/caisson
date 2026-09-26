// The Paddle parse->apply round trip (ADR-0108, the W2-class seam trap): a REAL signed Paddle
// transaction.completed webhook, run through the REAL createPaddleBilling driver (verify + parse, no
// fake), lands the right grant via handleBillingWebhook -> applyBillingEvent. Mirrors
// webhook.integration.test.ts's Stripe coverage, but exercises the actual HMAC verifier + mapper
// instead of a fakeProvider, since the Stripe<->Paddle swap is exactly the seam this guards.
import { createHmac } from "node:crypto";
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
import { type TestPg, newTestPg } from "@caisson/testing";
import {
  CREDIT_LINE_ITEM_MIGRATION_SQL,
  CREDIT_EXPIRY_MIGRATION_SQL,
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
  GRANT_CONSUMPTION_MIGRATION_SQL,
  balance,
} from "@caisson/credits";
import { withTenant } from "@caisson/tenancy-rls";
import {
  createPaddleBilling,
  PROCESSED_EVENT_SCHEMA_SQL,
} from "@caisson/billing-orchestration";
import {
  ENTITLEMENT_GRANT_CHARGED_AMOUNT_MIGRATION_SQL,
  ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL,
  ENTITLEMENT_GRANT_REFUNDED_AMOUNT_MIGRATION_SQL,
  ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL,
  RENEWAL_EXTENSION_MONTHS_MIGRATION_SQL,
  RENEWAL_EXTENSION_SCHEMA_SQL,
  ENTITLEMENT_SCHEMA_SQL,
  readEntitlements,
} from "./entitlement-store.ts";
import {
  ORDER_RECORD_SCHEMA_SQL,
  ORDER_RECORD_SUBSCRIPTION_LINK_MIGRATION_SQL,
  ORDER_RECORD_DISCOUNT_MIGRATION_SQL,
  SUBSCRIPTION_STATUS_SCHEMA_SQL,
} from "./subscription-history-store.ts";
import { handleBillingWebhook } from "./webhook.ts";

const SECRET = "pdl_ntfset_round_trip_secret";

function signed(body: string, t: number): string {
  const sig = createHmac("sha256", SECRET).update(`${t}:${body}`).digest("hex");
  return `ts=${t};h1=${sig}`;
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
  await tp.exec(SUBSCRIPTION_STATUS_SCHEMA_SQL);
  await tp.exec(ORDER_RECORD_SCHEMA_SQL);
  await tp.exec(ORDER_RECORD_SUBSCRIPTION_LINK_MIGRATION_SQL);
  await tp.exec(ORDER_RECORD_DISCOUNT_MIGRATION_SQL); // ADR-0315 affiliate-attribution column
  await tp.exec(PROCESSED_EVENT_SCHEMA_SQL);
});

afterAll(async () => {
  await tp.close();
});

describe("Paddle parsePaddleEvent -> applyBillingEvent (round trip, ADR-0108)", () => {
  test("a one-time transaction.completed webhook grants the purchase's credits", async () => {
    const acct = "acct_paddle_purchase";
    const now = Math.floor(Date.now() / 1000);
    const rawBody = JSON.stringify({
      event_id: "evt_paddle_purchase_1",
      event_type: "transaction.completed",
      data: {
        id: "txn_round_trip_1",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: "price_credit_pack_PLACEHOLDER" } }],
        details: { totals: { grand_total: "5000" } },
      },
    });
    const provider = createPaddleBilling({
      webhookSecret: SECRET,
      apiKey: "pdl_sdbx_test",
    });
    const res = await handleBillingWebhook(
      tp.pg,
      provider,
      rawBody,
      signed(rawBody, now),
    );
    expect(res.event?.type).toBe("purchase.completed");
    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(5000); // PURCHASE_BOOK price_credit_pack_PLACEHOLDER.credits
  });

  test("a one-time edition purchase webhook grants the entitlement (no credits)", async () => {
    const acct = "acct_paddle_edition";
    const now = Math.floor(Date.now() / 1000);
    const rawBody = JSON.stringify({
      event_id: "evt_paddle_edition_1",
      event_type: "transaction.completed",
      data: {
        id: "txn_round_trip_2",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: "price_compliance_onetime_PLACEHOLDER" } }],
        details: { totals: { grand_total: "129900" } },
      },
    });
    const provider = createPaddleBilling({
      webhookSecret: SECRET,
      apiKey: "pdl_sdbx_test",
    });
    await handleBillingWebhook(tp.pg, provider, rawBody, signed(rawBody, now));
    const entitlements = await withTenant(tp.pg, acct, (tx) =>
      readEntitlements(tx, acct),
    );
    expect(entitlements).toEqual(["compliance"]);
  });

  test("a subscription-linked transaction.completed grants the cycle allotment (cycle/invoice path)", async () => {
    const acct = "acct_paddle_cycle";
    const now = Math.floor(Date.now() / 1000);
    const rawBody = JSON.stringify({
      event_id: "evt_paddle_cycle_1",
      event_type: "transaction.completed",
      data: {
        id: "txn_round_trip_3",
        subscription_id: "sub_round_trip",
        // "web" = the subscription's FIRST charge from a Paddle.js checkout (verified 2026-07-01;
        // "subscription_charge" is a mid-cycle one-time charge and no longer grants).
        origin: "web",
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: "price_developer_monthly_PLACEHOLDER" } }],
        details: { totals: { grand_total: "4900" } },
      },
    });
    const provider = createPaddleBilling({
      webhookSecret: SECRET,
      apiKey: "pdl_sdbx_test",
    });
    const res = await handleBillingWebhook(
      tp.pg,
      provider,
      rawBody,
      signed(rawBody, now),
    );
    expect(res.event?.type).toBe("invoice.paid"); // never purchase.completed (ADR-0108 guard)
    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(1000); // PLAN_BOOK price_developer_monthly_PLACEHOLDER.creditsPerCycle
  });

  test("a discounted one-time webhook stamps order_record.discount_id (ADR-0315 end to end)", async () => {
    const acct = "acct_paddle_affiliate";
    const now = Math.floor(Date.now() / 1000);
    // A discounted purchase: 9900 list, 990 off (10%), 8910 charged, redeeming the affiliate's
    // discount dsc_01kx5b0f9majy4wbgq5cjgdm7y — the join key that must land on the order row.
    const rawBody = JSON.stringify({
      event_id: "evt_paddle_affiliate_1",
      event_type: "transaction.completed",
      data: {
        id: "txn_affiliate_1",
        subscription_id: null,
        discount_id: "dsc_01kx5b0f9majy4wbgq5cjgdm7y",
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: "price_credit_pack_PLACEHOLDER" } }],
        details: { totals: { grand_total: "8910" } },
      },
    });
    const provider = createPaddleBilling({
      webhookSecret: SECRET,
      apiKey: "pdl_sdbx_test",
    });
    const res = await handleBillingWebhook(
      tp.pg,
      provider,
      rawBody,
      signed(rawBody, now),
    );
    expect(res.event?.type).toBe("purchase.completed");
    // Superuser read (bypasses order_record RLS) — the discount id joined onto the order row.
    const rows = await tp.query<{ discount_id: string | null; amount: number }>(
      `SELECT discount_id, amount FROM order_record WHERE source_event_id = $1 AND kind = 'purchase'`,
      ["txn_affiliate_1"],
    );
    expect(rows[0]?.discount_id).toBe("dsc_01kx5b0f9majy4wbgq5cjgdm7y");
    expect(rows[0]?.amount).toBe(8910); // the charged (post-discount) total is the commission base
  });

  test("a bad Paddle signature throws before any DB work (fail-closed)", async () => {
    const rawBody = JSON.stringify({
      event_id: "evt_paddle_bad_sig",
      event_type: "transaction.completed",
      data: { id: "txn_x", custom_data: { account_id: "acct_x" } },
    });
    const provider = createPaddleBilling({
      webhookSecret: SECRET,
      apiKey: "pdl_sdbx_test",
    });
    await expect(
      handleBillingWebhook(tp.pg, provider, rawBody, "ts=1;h1=deadbeef"),
    ).rejects.toThrow();
  });
});

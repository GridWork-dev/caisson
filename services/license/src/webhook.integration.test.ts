// handleBillingWebhook wiring (ADR-0089): a verified actionable event runs the mapper inside withTenant;
// a null event (unhandled type) is a no-op success; a verified actionable event with an unresolvable
// accountId throws (non-2xx, so the provider retries — services-hardening LOW finding); a bad signature
// throws before any DB work. The BillingProvider is FAKED (no real HMAC) — the verify path itself is
// covered in @caisson/billing.
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
import { AuthnError, InternalError } from "@caisson/kernel";
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
import type { BillingProvider, DomainBillingEvent } from "@caisson/billing";
import { PROCESSED_EVENT_SCHEMA_SQL } from "@caisson/billing-orchestration";
import {
  ENTITLEMENT_GRANT_CHARGED_AMOUNT_MIGRATION_SQL,
  ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL,
  ENTITLEMENT_GRANT_REFUNDED_AMOUNT_MIGRATION_SQL,
  ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL,
  RENEWAL_EXTENSION_MONTHS_MIGRATION_SQL,
  RENEWAL_EXTENSION_SCHEMA_SQL,
  ENTITLEMENT_SCHEMA_SQL,
} from "./entitlement-store.ts";
import {
  ORDER_RECORD_SCHEMA_SQL,
  ORDER_RECORD_SUBSCRIPTION_LINK_MIGRATION_SQL,
  ORDER_RECORD_DISCOUNT_MIGRATION_SQL,
  SUBSCRIPTION_STATUS_SCHEMA_SQL,
} from "./subscription-history-store.ts";
import { handleBillingWebhook } from "./webhook.ts";

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(CREDIT_SCHEMA_SQL);
  await tp.exec(CREDIT_ROUNDING_MIGRATION_SQL);
  await tp.exec(CREDIT_LINE_ITEM_MIGRATION_SQL);
  await tp.exec(CREDIT_EXPIRY_MIGRATION_SQL);
  await tp.exec(GRANT_CONSUMPTION_MIGRATION_SQL);
  // The handler grants credits AND entitlements in one tx (ADR-0071), so the account_entitlement
  // table must exist or a future entitlement-bearing event would fail mid-transaction.
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
  // The outer webhook-event dedup table (ADR-0229 rows 50+51) — handleBillingWebhook now claims the
  // event via processEvent before granting, so a re-delivery grants + pushes once.
  await tp.exec(PROCESSED_EVENT_SCHEMA_SQL);
});

afterAll(async () => {
  await tp.close();
});

function fakeProvider(
  event: DomainBillingEvent | null,
  throwOnVerify = false,
): BillingProvider {
  return {
    verifyAndParse() {
      if (throwOnVerify) throw new AuthnError("bad signature");
      return event;
    },
    async createCheckout() {
      return { url: "https://example.test/checkout" };
    },
  };
}

describe("handleBillingWebhook", () => {
  test("a verified invoice.paid runs the grant mapper inside withTenant", async () => {
    const acct = "acct_wh";
    const ev: DomainBillingEvent = {
      type: "invoice.paid",
      sourceEventId: "evt_wh",
      accountId: acct,
      amountTotal: 9900,
      currency: "usd",
      subscriptionId: "sub_wh",
      priceId: "price_developer_monthly_PLACEHOLDER",
      billingReason: "subscription_cycle",
      invoiceId: "in_wh",
    };
    const res = await handleBillingWebhook(
      tp.pg,
      fakeProvider(ev),
      "{}",
      "sig",
    );
    expect(res.event?.type).toBe("invoice.paid");
    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(1000);
  });

  test("an actionable invoice.paid with an empty accountId throws (non-2xx) — never silently drops a paid cycle", async () => {
    // readAccountId returns "" when no metadata resolves. This is a VERIFIED, actionable event we
    // cannot attribute to a tenant — a genuinely paid purchase/cycle, not a benign unhandled-type
    // no-op. It must throw (so the HTTP layer returns non-2xx and the provider retries) rather than
    // silently 2xx-ing and dropping the grant for good (services-hardening LOW finding). It must also
    // NEVER reach withTenant(pg, "", …), which would fail-closed on an empty tenant anyway (TenancyError)
    // but for the wrong reason.
    const ev: DomainBillingEvent = {
      type: "invoice.paid",
      sourceEventId: "evt_empty",
      accountId: "",
      amountTotal: 9900,
      currency: "usd",
      subscriptionId: "sub_empty",
      priceId: "price_developer_monthly_PLACEHOLDER",
      billingReason: "subscription_cycle",
      invoiceId: "in_empty",
    };
    await expect(
      handleBillingWebhook(tp.pg, fakeProvider(ev), "{}", "sig"),
    ).rejects.toThrow(InternalError);
  });

  test("an unhandled event (null) is a no-op success", async () => {
    const res = await handleBillingWebhook(
      tp.pg,
      fakeProvider(null),
      "{}",
      "sig",
    );
    expect(res.event).toBeNull();
  });

  test("a bad signature throws before any DB work", async () => {
    await expect(
      handleBillingWebhook(tp.pg, fakeProvider(null, true), "{}", "bad"),
    ).rejects.toThrow(AuthnError);
  });

  test("a re-delivered purchase.completed grants credits once AND pushes Discord once (ADR-0229 rows 50+51)", async () => {
    // A multi-line cart: an edition line (entitlement, grantedEntitlements non-empty → the app.ts push
    // fires) + a credit-pack line (5000 credits → the grant is observable in the balance). Delivered
    // twice with the SAME sourceEventId, exactly as a Paddle re-delivery arrives.
    const acct = "acct_redeliver";
    const ev: DomainBillingEvent = {
      type: "purchase.completed",
      sourceEventId: "evt_redeliver",
      accountId: acct,
      amountTotal: 79800,
      currency: "usd",
      paymentId: "pi_redeliver",
      lineItems: [
        {
          priceId: "price_compliance_onetime_PLACEHOLDER",
          quantity: 1,
          itemId: "itm_edition",
          chargedAmount: 74900,
        },
        {
          priceId: "price_credit_pack_PLACEHOLDER",
          quantity: 1,
          itemId: "itm_credits",
          chargedAmount: 4900,
        },
      ],
    };

    // First delivery: grants credits + entitlements, so the (gated) Discord push would fire.
    const first = await handleBillingWebhook(
      tp.pg,
      fakeProvider(ev),
      "{}",
      "s",
    );
    expect(first.grantedEntitlements.length).toBeGreaterThan(0);
    const balAfterFirst = await withTenant(tp.pg, acct, (tx) =>
      balance(tx, acct),
    );
    expect(balAfterFirst).toBe(5000);

    // Re-delivery of the SAME event: the outer processEvent claim short-circuits the grant, so no
    // entitlements are returned (the post-commit Discord push is gated out) and no credits are re-granted.
    const second = await handleBillingWebhook(
      tp.pg,
      fakeProvider(ev),
      "{}",
      "s",
    );
    expect(second.grantedEntitlements).toEqual([]);
    const balAfterSecond = await withTenant(tp.pg, acct, (tx) =>
      balance(tx, acct),
    );
    expect(balAfterSecond).toBe(5000);
  });
});

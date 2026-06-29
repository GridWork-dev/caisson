// handleBillingWebhook wiring (ADR-0089): a verified actionable event runs the mapper inside withTenant;
// a null event (unhandled type) is a no-op success; a bad signature throws before any DB work. The
// BillingProvider is FAKED (no real HMAC) — the verify path itself is covered in @caisson/billing.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { AuthnError } from "@caisson/kernel";
import { type TestPg, newTestPg } from "@caisson/testing";
import { CREDIT_SCHEMA_SQL, balance } from "@caisson/credits";
import { withTenant } from "@caisson/tenancy-rls";
import type { BillingProvider, DomainBillingEvent } from "@caisson/billing";
import { handleBillingWebhook } from "./webhook.ts";

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(CREDIT_SCHEMA_SQL);
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

  test("an actionable invoice.paid with an empty accountId is a no-op success — never grants under an empty tenant", async () => {
    // readAccountId returns "" when no metadata resolves. The guard short-circuits to a 2xx no-op;
    // WITHOUT it, handleBillingWebhook would call withTenant(pg, "", …), which fail-closes
    // (TenancyError). So this asserting it returns cleanly (does not throw) proves the guard holds.
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
    const res = await handleBillingWebhook(
      tp.pg,
      fakeProvider(ev),
      "{}",
      "sig",
    );
    expect(res.event?.type).toBe("invoice.paid"); // returned as a no-op success, no grant attempted
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
});

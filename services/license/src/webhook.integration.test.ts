// handleBillingWebhook wiring (ADR-0089): a verified actionable event runs the mapper inside withTenant;
// a null event (unhandled type) is a no-op success; a verified actionable event with an unresolvable
// accountId throws (non-2xx, so the provider retries — services-hardening LOW finding); a bad signature
// throws before any DB work. The BillingProvider is FAKED (no real HMAC) — the verify path itself is
// covered in @caisson/billing.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { AuthnError, InternalError } from "@caisson/kernel";
import { type TestPg, newTestPg } from "@caisson/testing";
import { CREDIT_SCHEMA_SQL, balance } from "@caisson/credits";
import { withTenant } from "@caisson/tenancy-rls";
import type { BillingProvider, DomainBillingEvent } from "@caisson/billing";
import { ENTITLEMENT_SCHEMA_SQL } from "./entitlement-store.ts";
import { handleBillingWebhook } from "./webhook.ts";

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(CREDIT_SCHEMA_SQL);
  // The handler grants credits AND entitlements in one tx (ADR-0071), so the account_entitlement
  // table must exist or a future entitlement-bearing event would fail mid-transaction.
  await tp.exec(ENTITLEMENT_SCHEMA_SQL);
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
});

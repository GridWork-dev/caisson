// The ADR-0089 cycle->grant mapper, end to end on PGlite + real withTenant (ADR-0005 RLS). Asserts the
// binding test list: invoice.paid(create|cycle) grants once; a retry on the SAME invoice id is
// idempotent (one row); two invoice ids grant twice; subscription.* lifecycle events grant nothing;
// proration (subscription_update) grants nothing; an unknown price id fails closed (throws, no row);
// cancel never claws back. Each test uses its own account id so no cross-test cleanup is needed.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ConfigError } from "@caisson/kernel";
import { type TestPg, newTestPg } from "@caisson/testing";
import { CREDIT_SCHEMA_SQL, balance, getLedger } from "@caisson/credits";
import { withTenant } from "@caisson/tenancy-rls";
import { type DomainBillingEvent, parseStripeEvent } from "@caisson/billing";
import { applyBillingEvent } from "./apply-billing-event.ts";

const PLAN_ID = "price_developer_monthly_PLACEHOLDER"; // 1000 credits/cycle (placeholder)
const CREDITS = 1000;

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(CREDIT_SCHEMA_SQL);
});

afterAll(async () => {
  await tp.close();
});

function invoicePaid(
  accountId: string,
  invoiceId: string,
  opts: { billingReason?: string; priceId?: string; eventId?: string } = {},
): DomainBillingEvent {
  return {
    type: "invoice.paid",
    sourceEventId: opts.eventId ?? `evt_${invoiceId}`,
    accountId,
    amountTotal: 9900,
    currency: "usd",
    subscriptionId: "sub_1",
    priceId: opts.priceId ?? PLAN_ID,
    billingReason: opts.billingReason ?? "subscription_cycle",
    invoiceId,
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

  test("subscription.canceled grants nothing and never claws back", async () => {
    const acct = "acct_cancel";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, invoicePaid(acct, "in_c")),
    );
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, {
        type: "subscription.canceled",
        sourceEventId: "evt_x",
        accountId: acct,
      }),
    );
    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(CREDITS); // prior balance intact
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

  test("purchase.completed grants nothing here (one-time entitlement is the resolver's job)", async () => {
    const acct = "acct_purchase";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, {
        type: "purchase.completed",
        sourceEventId: "evt_p",
        accountId: acct,
        amountTotal: 89900,
        currency: "usd",
      }),
    );
    const ledger = await withTenant(tp.pg, acct, (tx) => getLedger(tx, acct));
    expect(ledger).toHaveLength(0);
  });
});

// The ADR-0089 cycle->grant mapper, end to end on PGlite + real withTenant (ADR-0005 RLS). Asserts the
// binding test list: invoice.paid(create|cycle) grants once; a retry on the SAME invoice id is
// idempotent (one row); two invoice ids grant twice; subscription.* lifecycle events grant nothing;
// proration (subscription_update) grants nothing; an unknown price id fails closed (throws, no row);
// cancel never claws back. Each test uses its own account id so no cross-test cleanup is needed.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ConfigError } from "@caisson/kernel";
import { type TestPg, newTestPg } from "@caisson/testing";
import { CREDIT_SCHEMA_SQL, balance, debit, getLedger } from "@caisson/credits";
import { withTenant } from "@caisson/tenancy-rls";
import { type DomainBillingEvent, parseStripeEvent } from "@caisson/billing";
import { applyBillingEvent } from "./apply-billing-event.ts";
import {
  ENTITLEMENT_SCHEMA_SQL,
  readEntitlements,
} from "./entitlement-store.ts";

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
): DomainBillingEvent {
  return {
    type: "purchase.completed",
    sourceEventId: `evt_${paymentId}`,
    accountId,
    amountTotal: 499900,
    currency: "usd",
    priceId,
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
  };
}

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(CREDIT_SCHEMA_SQL);
  await tp.exec(ENTITLEMENT_SCHEMA_SQL);
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
});

describe("applyBillingEvent — refund: revoke + claw unspent credits (ADR-0113)", () => {
  test("refund soft-revokes the purchase's entitlement AND claws back the full unspent grant", async () => {
    const acct = "acct_refund_full";
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, purchaseCompleted(acct, "pi_rf", CREDIT_PACK_ID)),
    );
    // Also a one-time edition so the refund has an entitlement to revoke.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        // SAME payment id so the refund revokes this entitlement grant too.
        purchaseCompleted(acct, "pi_rf", ONETIME_EDITION_ID),
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
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompleted(acct, "pi_sp", ONETIME_EDITION_ID),
      ),
    );
    // Grant a separate credit pack on the SAME purchase so there are credits to spend + claw.
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(tx, purchaseCompleted(acct, "pi_sp", CREDIT_PACK_ID)),
    );
    // Spend 4000 of the 5000.
    await withTenant(tp.pg, acct, (tx) =>
      debit(tx, {
        eventType: "codegen_debit",
        accountId: acct,
        amount: 4000,
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
        amount: PACK_CREDITS,
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
    expect(ledger.map((e) => e.event_type)).toEqual([
      "purchase",
      "codegen_debit",
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
      applyBillingEvent(tx, purchaseCompleted(acct, "pi_pt", CREDIT_PACK_ID)),
    );
    await withTenant(tp.pg, acct, (tx) =>
      applyBillingEvent(
        tx,
        purchaseCompleted(acct, "pi_pt", ONETIME_EDITION_ID),
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

// Billing seam (ADR-0017): raw-body HMAC webhook verification + Stripe→domain event mapping.
// The verified event carries everything the credit grant needs (sourceEventId → idempotency).
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, test } from "bun:test";
import { AuthnError } from "@caisson/kernel";
import {
  createStripeBilling,
  parseStripeEvent,
  verifyStripeWebhook,
} from "./index.ts";

const SECRET = "whsec_test_secret";
const T = 1_700_000_000;

function signed(body: string, secret = SECRET, t = T): string {
  const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${sig}`;
}

const checkoutBody = JSON.stringify({
  id: "evt_123",
  type: "checkout.session.completed",
  data: {
    object: {
      amount_total: 89900,
      currency: "usd",
      payment_intent: "pi_123",
      metadata: { account_id: "acct_a", price_id: "price_pack_PLACEHOLDER" },
    },
  },
});

describe("Stripe webhook verification", () => {
  test("accepts a valid signature within tolerance", () => {
    expect(() =>
      verifyStripeWebhook(checkoutBody, signed(checkoutBody), SECRET, {
        now: T,
      }),
    ).not.toThrow();
  });

  test("rejects a tampered body", () => {
    const header = signed(checkoutBody);
    expect(() =>
      verifyStripeWebhook(`${checkoutBody} `, header, SECRET, { now: T }),
    ).toThrow(AuthnError);
  });

  test("rejects the wrong secret", () => {
    expect(() =>
      verifyStripeWebhook(
        checkoutBody,
        signed(checkoutBody, "whsec_wrong"),
        SECRET,
        { now: T },
      ),
    ).toThrow(AuthnError);
  });

  test("rejects an out-of-tolerance timestamp (replay)", () => {
    expect(() =>
      verifyStripeWebhook(checkoutBody, signed(checkoutBody), SECRET, {
        now: T + 1000,
      }),
    ).toThrow(AuthnError);
  });
});

describe("event mapping", () => {
  test("checkout.session.completed → purchase.completed (one-time enrichment, ADR-0109)", () => {
    const event = JSON.parse(checkoutBody) as Parameters<
      typeof parseStripeEvent
    >[0];
    expect(parseStripeEvent(event)).toEqual({
      type: "purchase.completed",
      sourceEventId: "evt_123",
      accountId: "acct_a",
      amountTotal: 89900,
      currency: "usd",
      priceId: "price_pack_PLACEHOLDER",
      paymentId: "pi_123",
    });
  });

  test("customer.subscription.deleted → subscription.canceled carries the subscription id (ADR-0109)", () => {
    const event = {
      id: "evt_del",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_gone", metadata: { account_id: "acct_a" } } },
    } as Parameters<typeof parseStripeEvent>[0];
    expect(parseStripeEvent(event)).toEqual({
      type: "subscription.canceled",
      sourceEventId: "evt_del",
      accountId: "acct_a",
      subscriptionId: "sub_gone",
    });
  });

  test("charge.refunded → refund.completed joins on the PaymentIntent id (ADR-0109)", () => {
    // The Charge carries the account on its own metadata (Stripe copies the PaymentIntent metadata
    // stamped at checkout onto the Charge) and `payment_intent` — the join key back to the purchase.
    const event = {
      id: "evt_ref",
      type: "charge.refunded",
      data: {
        object: {
          payment_intent: "pi_123",
          amount_refunded: 89900,
          currency: "usd",
          refunded: true,
          metadata: { account_id: "acct_a" },
        },
      },
    } as Parameters<typeof parseStripeEvent>[0];
    expect(parseStripeEvent(event)).toEqual({
      type: "refund.completed",
      sourceEventId: "evt_ref",
      accountId: "acct_a",
      paymentId: "pi_123",
      amountRefunded: 89900,
      currency: "usd",
      fullyRefunded: true,
    });
  });

  test("a PARTIAL charge.refunded maps with fullyRefunded=false (mapper no-ops downstream)", () => {
    // Stripe leaves `refunded` false on a partial refund; the services/license mapper must not revoke
    // all access or claw the whole grant (ADR-0109 W1).
    const event = {
      id: "evt_partial",
      type: "charge.refunded",
      data: {
        object: {
          payment_intent: "pi_123",
          amount_refunded: 100,
          currency: "usd",
          refunded: false,
          metadata: { account_id: "acct_a" },
        },
      },
    } as Parameters<typeof parseStripeEvent>[0];
    const parsed = parseStripeEvent(event);
    expect(parsed?.type).toBe("refund.completed");
    expect(parsed && "fullyRefunded" in parsed && parsed.fullyRefunded).toBe(
      false,
    );
  });

  test("a subscription-mode checkout.session.completed maps to null (not a one-time purchase)", () => {
    // Subscription signups fire this event too, but carry no PaymentIntent — the first grant arrives
    // via invoice.paid. Mapping to purchase.completed would throw on the empty paymentId (ADR-0109 B1).
    const event = {
      id: "evt_cs_sub",
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          payment_intent: null,
          metadata: { account_id: "acct_a" },
          client_reference_id: "acct_a",
        },
      },
    } as Parameters<typeof parseStripeEvent>[0];
    expect(parseStripeEvent(event)).toBeNull();
  });

  test("invoice.paid → enriched domain event (ADR-0089 seam)", () => {
    const event = {
      id: "evt_inv",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_123",
          amount_paid: 9900,
          currency: "usd",
          subscription: "sub_123",
          billing_reason: "subscription_cycle",
          metadata: { account_id: "acct_a" },
          lines: { data: [{ price: { id: "price_dev_PLACEHOLDER" } }] },
        },
      },
    } as Parameters<typeof parseStripeEvent>[0];
    expect(parseStripeEvent(event)).toEqual({
      type: "invoice.paid",
      sourceEventId: "evt_inv",
      accountId: "acct_a",
      amountTotal: 9900,
      currency: "usd",
      subscriptionId: "sub_123",
      priceId: "price_dev_PLACEHOLDER",
      billingReason: "subscription_cycle",
      invoiceId: "in_123",
    });
  });

  test("invoice.paid resolves the account from subscription_details.metadata (cycle invoice)", () => {
    // A real subscription cycle invoice carries the account on subscription_details.metadata (reflected
    // from subscription_data[metadata] at checkout) — NOT on top-level metadata / client_reference_id,
    // which Stripe never copies onto invoices. readAccountId must read it here or the grant never fires.
    const event = {
      id: "evt_sub",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_sub",
          amount_paid: 9900,
          currency: "usd",
          subscription: "sub_x",
          billing_reason: "subscription_cycle",
          subscription_details: { metadata: { account_id: "acct_sub" } },
          lines: { data: [{ price: { id: "price_dev_PLACEHOLDER" } }] },
        },
      },
    } as Parameters<typeof parseStripeEvent>[0];
    expect(parseStripeEvent(event)?.accountId).toBe("acct_sub");
  });

  test("an unhandled event type maps to null", () => {
    expect(
      parseStripeEvent({
        id: "evt_x",
        type: "payment_intent.created",
        data: { object: {} },
      }),
    ).toBeNull();
  });

  test("verifyAndParse ties verification + mapping behind the port", () => {
    const billing = createStripeBilling({
      webhookSecret: SECRET,
      apiKey: "sk_test",
    });
    const out = billing.verifyAndParse(checkoutBody, signed(checkoutBody), {
      now: T,
    });
    expect(out).toMatchObject({
      type: "purchase.completed",
      accountId: "acct_a",
    });
  });
});

describe("createCheckout — metadata stamping (ADR-0109 refund tenant-resolution)", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  // Capture the form-encoded body createCheckout POSTs to Stripe, returning a stub session url.
  async function paramsFor(input: {
    mode: "payment" | "subscription";
    priceId: string;
    accountId: string;
  }): Promise<URLSearchParams> {
    let body = "";
    globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
      body = init?.body ?? "";
      return new Response(JSON.stringify({ url: "https://checkout.test/s" }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    const billing = createStripeBilling({
      webhookSecret: SECRET,
      apiKey: "sk_test",
    });
    await billing.createCheckout({
      ...input,
      successUrl: "https://app.test/ok",
      cancelUrl: "https://app.test/no",
    });
    return new URLSearchParams(body);
  }

  test("a one-time (payment) checkout stamps payment_intent_data metadata (the refund join key)", async () => {
    const p = await paramsFor({
      mode: "payment",
      priceId: "price_x",
      accountId: "acct_a",
    });
    // Load-bearing: Stripe copies PaymentIntent metadata onto the Charge, so charge.refunded can
    // resolve the tenant + the purchase. Dropping these silently breaks the refund clawback path.
    expect(p.get("payment_intent_data[metadata][account_id]")).toBe("acct_a");
    expect(p.get("payment_intent_data[metadata][price_id]")).toBe("price_x");
    expect(p.get("metadata[price_id]")).toBe("price_x");
    expect(p.get("metadata[account_id]")).toBe("acct_a");
  });

  test("a subscription checkout stamps subscription_data metadata (cycle-invoice tenant resolution)", async () => {
    const p = await paramsFor({
      mode: "subscription",
      priceId: "price_sub",
      accountId: "acct_b",
    });
    expect(p.get("subscription_data[metadata][account_id]")).toBe("acct_b");
    // A subscription checkout must NOT stamp the one-time payment_intent_data fields.
    expect(p.get("payment_intent_data[metadata][account_id]")).toBeNull();
  });
});

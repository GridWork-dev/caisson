// Billing seam (ADR-0017): raw-body HMAC webhook verification + Stripe→domain event mapping.
// The verified event carries everything the credit grant needs (sourceEventId → idempotency).
import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
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
      metadata: { account_id: "acct_a" },
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
  test("checkout.session.completed → purchase.completed", () => {
    const event = JSON.parse(checkoutBody) as Parameters<
      typeof parseStripeEvent
    >[0];
    expect(parseStripeEvent(event)).toEqual({
      type: "purchase.completed",
      sourceEventId: "evt_123",
      accountId: "acct_a",
      amountTotal: 89900,
      currency: "usd",
    });
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
          // The real cycle-invoice shape: account on subscription_details.metadata (readAccountId's
          // PRIMARY source), not top-level metadata (its fallback).
          subscription_details: { metadata: { account_id: "acct_a" } },
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

// Stripe webhook signature verification (ADR-0017) — the open verify-only half of the billing seam
// (carve ADR-0249 G3). Stripe->domain event mapping + the driver + createCheckout are covered in the
// commercial @caisson-sh/billing-orchestration (src/stripe.test.ts).
import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { AuthnError } from "@caisson-sh/kernel";
import { verifyStripeWebhook } from "./index.ts";

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

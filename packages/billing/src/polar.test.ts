// Polar webhook signature verification (ADR-0175, Standard Webhooks) — the open verify-only half of the
// billing seam (carve ADR-0249 G3). Polar->domain event mapping + the driver + createCheckout are covered
// in the commercial @caisson-sh/billing-orchestration (src/polar.test.ts). Synthetic secrets only.
import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { AuthnError } from "@caisson-sh/kernel";
import { verifyPolarWebhook } from "./index.ts";

// A Standard Webhooks secret is base64 (optionally `whsec_`-prefixed).
const SECRET = `whsec_${Buffer.from("polar-test-secret-bytes!").toString("base64")}`;
const ID = "msg_1";
const T = 1_700_000_000;

/** Builds the joined `id.timestamp.signature` string this driver's `signatureHeader` parameter expects
 * (see polar-webhook.ts's `parsePolarSignatureHeader` doc comment). */
function signed(body: string, id = ID, t = T, secret = SECRET): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const sig = createHmac("sha256", key)
    .update(`${id}.${t}.${body}`)
    .digest("base64");
  return `${id}.${t}.v1,${sig}`;
}

const orderPaidBody = JSON.stringify({
  type: "order.paid",
  data: {
    id: "order_1",
    total_amount: 5000,
    currency: "usd",
    billing_reason: "purchase",
    product_id: "prod_x",
    metadata: { account_id: "acct_a" },
  },
});

describe("Polar webhook verification (Standard Webhooks)", () => {
  test("accepts a valid signature within tolerance", () => {
    expect(() =>
      verifyPolarWebhook(orderPaidBody, signed(orderPaidBody), SECRET, {
        now: T,
      }),
    ).not.toThrow();
  });

  test("rejects a tampered body", () => {
    const header = signed(orderPaidBody);
    expect(() =>
      verifyPolarWebhook(`${orderPaidBody} `, header, SECRET, { now: T }),
    ).toThrow(AuthnError);
  });

  test("rejects the wrong secret", () => {
    const wrongSecret = `whsec_${Buffer.from("a-different-secret-entirely").toString("base64")}`;
    expect(() =>
      verifyPolarWebhook(
        orderPaidBody,
        signed(orderPaidBody, ID, T, wrongSecret),
        SECRET,
        { now: T },
      ),
    ).toThrow(AuthnError);
  });

  test("rejects an out-of-tolerance timestamp (replay)", () => {
    expect(() =>
      verifyPolarWebhook(orderPaidBody, signed(orderPaidBody), SECRET, {
        now: T + 1000,
      }),
    ).toThrow(AuthnError);
  });

  test("rejects a malformed (unjoined) signature header", () => {
    expect(() =>
      verifyPolarWebhook(orderPaidBody, "garbage", SECRET, { now: T }),
    ).toThrow(AuthnError);
  });
});

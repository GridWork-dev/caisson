// LemonSqueezy webhook signature verification (ADR-0175) — the open verify-only half of the billing seam
// (carve ADR-0249 G3). LemonSqueezy->domain event mapping + the driver + createCheckout are covered in
// the commercial @caisson-sh/billing-orchestration (src/lemonsqueezy.test.ts). Synthetic secrets only.
import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { AuthnError } from "@caisson-sh/kernel";
import { verifyLemonSqueezyWebhook } from "./index.ts";

const SECRET = "ls_test_secret";

function signed(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

const orderBody = JSON.stringify({
  meta: {
    event_name: "order_created",
    custom_data: { account_id: "acct_a" },
  },
  data: {
    type: "orders",
    id: "1",
    attributes: {
      total: 5000,
      currency: "USD",
      first_order_item: { variant_id: 42 },
    },
  },
});

describe("LemonSqueezy webhook verification", () => {
  test("accepts a valid signature", () => {
    expect(() =>
      verifyLemonSqueezyWebhook(orderBody, signed(orderBody), SECRET),
    ).not.toThrow();
  });

  test("rejects a tampered body", () => {
    const header = signed(orderBody);
    expect(() =>
      verifyLemonSqueezyWebhook(`${orderBody} `, header, SECRET),
    ).toThrow(AuthnError);
  });

  test("rejects the wrong secret", () => {
    expect(() =>
      verifyLemonSqueezyWebhook(
        orderBody,
        signed(orderBody, "ls_wrong_secret"),
        SECRET,
      ),
    ).toThrow(AuthnError);
  });

  test("rejects a malformed signature (wrong length)", () => {
    expect(() =>
      verifyLemonSqueezyWebhook(orderBody, "not-a-hex-digest", SECRET),
    ).toThrow(AuthnError);
  });
});

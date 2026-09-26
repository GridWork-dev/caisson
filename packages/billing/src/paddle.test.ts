// Paddle webhook signature verification (ADR-0108) — the open verify-only half of the billing seam
// (carve ADR-0249 G3). Paddle->domain event mapping + the driver + createCheckout are covered in the
// commercial @caisson-sh/billing-orchestration (src/paddle.test.ts). Synthetic secrets only — live Paddle
// creds + a live webhook smoke-test are operator/DEPLOY-class, out of scope here.
import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { AuthnError } from "@caisson-sh/kernel";
import { verifyPaddleWebhook } from "./index.ts";

const SECRET = "pdl_ntfset_test_secret";
const T = 1_700_000_000;

function signed(body: string, secret = SECRET, t = T): string {
  const sig = createHmac("sha256", secret).update(`${t}:${body}`).digest("hex");
  return `ts=${t};h1=${sig}`;
}

const oneTimeTxnBody = JSON.stringify({
  event_id: "evt_01gks14ge726w50ch2tmaw2a1x",
  event_type: "transaction.completed",
  data: {
    id: "txn_01hvcc93znj3mpqt1tenkjb04y",
    subscription_id: null,
    currency_code: "usd",
    custom_data: { account_id: "acct_a" },
    items: [{ price: { id: "price_credit_pack_PLACEHOLDER" } }],
    details: { totals: { grand_total: "5000" } },
  },
});

describe("Paddle webhook verification", () => {
  test("accepts a valid signature within tolerance", () => {
    expect(() =>
      verifyPaddleWebhook(oneTimeTxnBody, signed(oneTimeTxnBody), SECRET, {
        now: T,
      }),
    ).not.toThrow();
  });

  test("rejects a tampered body", () => {
    const header = signed(oneTimeTxnBody);
    expect(() =>
      verifyPaddleWebhook(`${oneTimeTxnBody} `, header, SECRET, { now: T }),
    ).toThrow(AuthnError);
  });

  test("rejects the wrong secret", () => {
    expect(() =>
      verifyPaddleWebhook(
        oneTimeTxnBody,
        signed(oneTimeTxnBody, "pdl_ntfset_wrong"),
        SECRET,
        { now: T },
      ),
    ).toThrow(AuthnError);
  });

  test("rejects an out-of-tolerance timestamp (replay)", () => {
    expect(() =>
      verifyPaddleWebhook(oneTimeTxnBody, signed(oneTimeTxnBody), SECRET, {
        now: T + 1000,
      }),
    ).toThrow(AuthnError);
  });

  test("rejects a malformed signature header", () => {
    expect(() =>
      verifyPaddleWebhook(oneTimeTxnBody, "garbage", SECRET, { now: T }),
    ).toThrow(AuthnError);
  });
});

// Shared BillingProvider port-conformance harness (ADR-0175): loops every driver in this package and
// asserts each satisfies the ONE port (provider.ts:15-31) — `verifyAndParse` (good signature accepted,
// bad signature rejected) and `createCheckout` (resolves `{ url }` off a mocked fetch). This did not
// exist before the LemonSqueezy/Polar addition; it now covers all four drivers (Stripe, Paddle,
// LemonSqueezy, Polar) so a future 5th driver has one place to plug into instead of a new bespoke suite.
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, test } from "bun:test";
import { AuthnError } from "@caisson-sh/kernel";
import type { BillingProvider } from "@caisson-sh/billing";
import {
  createLemonSqueezyBilling,
  createPaddleBilling,
  createPolarBilling,
  createStripeBilling,
} from "./index.ts";

const T = 1_700_000_000;

interface ProviderCase {
  name: string;
  billing: BillingProvider;
  rawBody: string;
  goodSignature: string;
  badSignature: string;
  /** The mocked checkout-creation HTTP response body this driver expects to parse `{ url }` out of. */
  mockCheckoutResponse: unknown;
}

function stripeCase(): ProviderCase {
  const secret = "whsec_conformance_secret";
  const rawBody = JSON.stringify({
    id: "evt_conf",
    type: "checkout.session.completed",
    data: {
      object: {
        amount_total: 1000,
        currency: "usd",
        payment_intent: "pi_conf",
        metadata: { account_id: "acct_conf" },
      },
    },
  });
  const sig = createHmac("sha256", secret)
    .update(`${T}.${rawBody}`)
    .digest("hex");
  return {
    name: "stripe",
    billing: createStripeBilling({ webhookSecret: secret, apiKey: "sk_test" }),
    rawBody,
    goodSignature: `t=${T},v1=${sig}`,
    badSignature: `t=${T},v1=deadbeef`,
    mockCheckoutResponse: { url: "https://stripe.test/c" },
  };
}

function paddleCase(): ProviderCase {
  const secret = "pdl_conformance_secret";
  const rawBody = JSON.stringify({
    event_id: "evt_conf",
    event_type: "transaction.completed",
    data: {
      id: "txn_conf",
      subscription_id: null,
      currency_code: "usd",
      custom_data: { account_id: "acct_conf" },
      items: [{ price: { id: "price_conf" } }],
      details: { totals: { grand_total: "1000" } },
    },
  });
  const sig = createHmac("sha256", secret)
    .update(`${T}:${rawBody}`)
    .digest("hex");
  return {
    name: "paddle",
    billing: createPaddleBilling({
      webhookSecret: secret,
      apiKey: "pdl_sdbx_test",
    }),
    rawBody,
    goodSignature: `ts=${T};h1=${sig}`,
    badSignature: `ts=${T};h1=deadbeef`,
    mockCheckoutResponse: {
      data: { checkout: { url: "https://paddle.test/c" } },
    },
  };
}

function lemonSqueezyCase(): ProviderCase {
  const secret = "ls_conformance_secret";
  const rawBody = JSON.stringify({
    meta: {
      event_name: "order_created",
      custom_data: { account_id: "acct_conf" },
    },
    data: {
      type: "orders",
      id: "1",
      attributes: {
        total: 1000,
        currency: "USD",
        first_order_item: { variant_id: 1 },
      },
    },
  });
  const sig = createHmac("sha256", secret).update(rawBody).digest("hex");
  return {
    name: "lemonsqueezy",
    billing: createLemonSqueezyBilling({
      apiKey: "ls_test_key",
      webhookSecret: secret,
      storeId: "store_1",
    }),
    rawBody,
    goodSignature: sig,
    badSignature: "0".repeat(64),
    mockCheckoutResponse: {
      data: { attributes: { url: "https://ls.test/c" } },
    },
  };
}

function polarCase(): ProviderCase {
  const secret = `whsec_${Buffer.from("polar-conformance-secret").toString("base64")}`;
  const id = "msg_conf";
  const rawBody = JSON.stringify({
    type: "order.paid",
    data: {
      id: "order_conf",
      total_amount: 1000,
      currency: "usd",
      billing_reason: "purchase",
      product_id: "prod_conf",
      metadata: { account_id: "acct_conf" },
    },
  });
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const sig = createHmac("sha256", key)
    .update(`${id}.${T}.${rawBody}`)
    .digest("base64");
  return {
    name: "polar",
    billing: createPolarBilling({
      accessToken: "polar_oat_test",
      webhookSecret: secret,
    }),
    rawBody,
    goodSignature: `${id}.${T}.v1,${sig}`,
    badSignature: `${id}.${T}.v1,${"A".repeat(sig.length)}`,
    mockCheckoutResponse: { url: "https://buy.polar.sh/c" },
  };
}

const cases = [stripeCase, paddleCase, lemonSqueezyCase, polarCase];

describe("BillingProvider port conformance", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  for (const build of cases) {
    const {
      name,
      billing,
      rawBody,
      goodSignature,
      badSignature,
      mockCheckoutResponse,
    } = build();

    describe(name, () => {
      test("satisfies the BillingProvider port shape", () => {
        expect(typeof billing.verifyAndParse).toBe("function");
        expect(typeof billing.createCheckout).toBe("function");
      });

      test("verifyAndParse accepts a validly signed body without throwing", () => {
        expect(() =>
          billing.verifyAndParse(rawBody, goodSignature, { now: T }),
        ).not.toThrow();
      });

      test("verifyAndParse rejects a badly signed body", () => {
        expect(() =>
          billing.verifyAndParse(rawBody, badSignature, { now: T }),
        ).toThrow(AuthnError);
      });

      test("createCheckout resolves { url } off the mocked HTTP response", async () => {
        globalThis.fetch = (async () =>
          new Response(JSON.stringify(mockCheckoutResponse), {
            status: 200,
          })) as unknown as typeof fetch;
        const result = await billing.createCheckout({
          accountId: "acct_conf",
          priceId: "price_conf",
          mode: "payment",
          successUrl: "https://app.test/ok",
          cancelUrl: "https://app.test/no",
        });
        expect(typeof result.url).toBe("string");
        expect(result.url.length).toBeGreaterThan(0);
      });
    });
  }
});

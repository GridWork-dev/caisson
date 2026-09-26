// Polar driver + mapper (ADR-0175): Polar→domain event mapping, the envelope boundary, hosted-checkout
// creation, and fail-closed config. The raw-body Standard-Webhooks signature-VERIFY assertions live with
// the open verifier in @caisson-sh/billing (packages/billing/src/polar.test.ts); this file covers the
// commercial parse/driver half (ADR-0249 G3). Synthetic secrets only.
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson-sh/kernel";
import {
  createPolarBilling,
  parsePolarEvent,
  PolarEventSchema,
} from "./index.ts";

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

describe("event mapping", () => {
  test("order.paid (billing_reason=purchase) -> purchase.completed", () => {
    const event = JSON.parse(orderPaidBody) as Parameters<
      typeof parsePolarEvent
    >[0];
    expect(parsePolarEvent(event)).toEqual({
      type: "purchase.completed",
      sourceEventId: "order.paid:order_1",
      accountId: "acct_a",
      amountTotal: 5000,
      currency: "usd",
      lineItems: [
        { priceId: "prod_x", quantity: 1, itemId: "", chargedAmount: 5000 },
      ],
      paymentId: "order_1",
    });
  });

  test("order.paid (billing_reason=subscription_create) never maps to purchase.completed", () => {
    const event = {
      type: "order.paid",
      data: {
        id: "order_2",
        total_amount: 129000,
        currency: "usd",
        billing_reason: "subscription_create",
        subscription_id: "sub_1",
        product_id: "prod_sub",
        metadata: { account_id: "acct_a" },
      },
    } as Parameters<typeof parsePolarEvent>[0];
    const parsed = parsePolarEvent(event);
    expect(parsed?.type).not.toBe("purchase.completed");
    expect(parsed).toEqual({
      type: "invoice.paid",
      sourceEventId: "order.paid:order_2",
      accountId: "acct_a",
      amountTotal: 129000,
      currency: "usd",
      subscriptionId: "sub_1",
      priceId: "prod_sub",
      billingReason: "subscription_create",
      invoiceId: "order_2",
    });
  });

  test("order.paid (billing_reason=subscription_cycle) is the renewal path", () => {
    const event = {
      type: "order.paid",
      data: {
        id: "order_3",
        total_amount: 129000,
        currency: "usd",
        billing_reason: "subscription_cycle",
        subscription_id: "sub_1",
        product_id: "prod_sub",
        metadata: { account_id: "acct_a" },
      },
    } as Parameters<typeof parsePolarEvent>[0];
    expect(parsePolarEvent(event)?.type).toBe("invoice.paid");
    expect(
      parsePolarEvent(event) &&
        "billingReason" in (parsePolarEvent(event) as object) &&
        (parsePolarEvent(event) as { billingReason: string }).billingReason,
    ).toBe("subscription_cycle");
  });

  test("a subscription-linked order.paid with no subscription id returns null (nothing to anchor)", () => {
    const event = {
      type: "order.paid",
      data: {
        id: "order_4",
        billing_reason: "subscription_create",
        metadata: { account_id: "acct_a" },
      },
    } as Parameters<typeof parsePolarEvent>[0];
    expect(parsePolarEvent(event)).toBeNull();
  });

  test("subscription.created carries the account id", () => {
    const event = {
      type: "subscription.created",
      data: { id: "sub_1", metadata: { account_id: "acct_a" } },
    } as Parameters<typeof parsePolarEvent>[0];
    expect(parsePolarEvent(event)).toEqual({
      type: "subscription.created",
      sourceEventId: "subscription.created:sub_1",
      accountId: "acct_a",
    });
  });

  test("subscription.canceled carries the subscription id", () => {
    const event = {
      type: "subscription.canceled",
      data: { id: "sub_gone", metadata: { account_id: "acct_a" } },
    } as Parameters<typeof parsePolarEvent>[0];
    expect(parsePolarEvent(event)).toEqual({
      type: "subscription.canceled",
      sourceEventId: "subscription.canceled:sub_gone",
      accountId: "acct_a",
      subscriptionId: "sub_gone",
    });
  });

  test("order.refunded (status=refunded) -> fullyRefunded true", () => {
    const event = {
      type: "order.refunded",
      data: {
        id: "order_1",
        refunded_amount: 5000,
        currency: "usd",
        status: "refunded",
        metadata: { account_id: "acct_a" },
      },
    } as Parameters<typeof parsePolarEvent>[0];
    expect(parsePolarEvent(event)).toEqual({
      type: "refund.completed",
      sourceEventId: "order.refunded:order_1",
      accountId: "acct_a",
      paymentId: "order_1",
      amountRefunded: 5000,
      currency: "usd",
      fullyRefunded: true,
      adjustmentId: "",
      items: [],
    });
  });

  test("order.refunded (status=partially_refunded) -> fullyRefunded false (ADR-0113 guard)", () => {
    const event = {
      type: "order.refunded",
      data: {
        id: "order_1",
        refunded_amount: 1000,
        currency: "usd",
        status: "partially_refunded",
        metadata: { account_id: "acct_a" },
      },
    } as Parameters<typeof parsePolarEvent>[0];
    expect(parsePolarEvent(event)?.type).toBe("refund.completed");
    expect(
      parsePolarEvent(event) &&
        "fullyRefunded" in (parsePolarEvent(event) as object)
        ? (parsePolarEvent(event) as { fullyRefunded: boolean }).fullyRefunded
        : undefined,
    ).toBe(false);
  });

  test("an unhandled event type maps to null", () => {
    expect(parsePolarEvent({ type: "customer.created", data: {} })).toBeNull();
  });

  test("verifyAndParse ties verification + mapping behind the port", () => {
    const billing = createPolarBilling({
      accessToken: "polar_oat_test",
      webhookSecret: SECRET,
    });
    const out = billing.verifyAndParse(orderPaidBody, signed(orderPaidBody), {
      now: T,
    });
    expect(out).toMatchObject({
      type: "purchase.completed",
      accountId: "acct_a",
    });
  });
});

describe("PolarEventSchema (envelope boundary validation)", () => {
  test("accepts a well-formed envelope", () => {
    const result = PolarEventSchema.safeParse({
      type: "order.paid",
      data: { id: "order_1" },
    });
    expect(result.success).toBe(true);
  });

  test("rejects an envelope with an unexpected extra top-level field", () => {
    const result = PolarEventSchema.safeParse({
      type: "order.paid",
      data: {},
      timestamp: "2026-01-01T00:00:00Z", // not a declared envelope field
    });
    expect(result.success).toBe(false);
  });

  test("rejects an envelope missing type or with the wrong shape", () => {
    expect(PolarEventSchema.safeParse({ data: {} }).success).toBe(false);
    expect(PolarEventSchema.safeParse({ type: 123, data: {} }).success).toBe(
      false,
    );
  });

  test("verifyAndParse rejects a signed body carrying an unexpected extra top-level field", () => {
    const extraFieldBody = JSON.stringify({
      type: "order.paid",
      data: {
        id: "order_extra",
        total_amount: 5000,
        currency: "usd",
        billing_reason: "purchase",
        metadata: { account_id: "acct_a" },
      },
      occurred_at: "2026-01-01T00:00:00Z",
    });
    const billing = createPolarBilling({
      accessToken: "polar_oat_test",
      webhookSecret: SECRET,
    });
    expect(() =>
      billing.verifyAndParse(extraFieldBody, signed(extraFieldBody), {
        now: T,
      }),
    ).toThrow(ValidationError);
  });
});

describe("createCheckout — Polar hosted checkout", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("posts products + metadata and returns the url", async () => {
    let body = "";
    let url = "";
    globalThis.fetch = (async (reqUrl: unknown, init?: { body?: string }) => {
      url = String(reqUrl);
      body = init?.body ?? "";
      return new Response(JSON.stringify({ url: "https://buy.polar.sh/c" }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    const billing = createPolarBilling({
      accessToken: "polar_oat_test",
      webhookSecret: SECRET,
      env: "sandbox",
    });
    const result = await billing.createCheckout({
      accountId: "acct_a",
      priceId: "prod_x",
      mode: "payment",
      successUrl: "https://app.test/ok",
      cancelUrl: "https://app.test/no",
    });
    expect(result.url).toBe("https://buy.polar.sh/c");
    expect(url).toBe("https://sandbox-api.polar.sh/v1/checkouts/");
    const parsed = JSON.parse(body) as {
      products: string[];
      metadata: { account_id: string };
    };
    expect(parsed.products).toEqual(["prod_x"]);
    expect(parsed.metadata.account_id).toBe("acct_a");
  });

  test("throws when Polar returns no checkout url", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({}), {
        status: 200,
      })) as unknown as typeof fetch;
    const billing = createPolarBilling({
      accessToken: "polar_oat_test",
      webhookSecret: SECRET,
    });
    await expect(
      billing.createCheckout({
        accountId: "acct_a",
        priceId: "prod_x",
        mode: "payment",
        successUrl: "https://app.test/ok",
        cancelUrl: "https://app.test/no",
      }),
    ).rejects.toThrow("Polar returned no checkout url");
  });
});

describe("createPolarBilling — fail-closed config", () => {
  test("throws ConfigError when a required config value is missing", () => {
    expect(() =>
      createPolarBilling({ accessToken: "", webhookSecret: SECRET }),
    ).toThrow("createPolarBilling requires `accessToken`");
  });
});

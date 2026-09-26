// LemonSqueezy driver + mapper (ADR-0175): LemonSqueezy→domain event mapping, the envelope boundary,
// hosted-checkout creation, and fail-closed config. The raw-body signature-VERIFY assertions live with
// the open verifier in @caisson-sh/billing (packages/billing/src/lemonsqueezy.test.ts); this file covers
// the commercial parse/driver half (ADR-0249 G3). Synthetic secrets only.
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson-sh/kernel";
import {
  createLemonSqueezyBilling,
  LemonSqueezyEventSchema,
  parseLemonSqueezyEvent,
} from "./index.ts";

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

describe("event mapping", () => {
  test("order_created -> purchase.completed", () => {
    const event = JSON.parse(orderBody) as Parameters<
      typeof parseLemonSqueezyEvent
    >[0];
    expect(parseLemonSqueezyEvent(event)).toEqual({
      type: "purchase.completed",
      sourceEventId: "orders:1",
      accountId: "acct_a",
      amountTotal: 5000,
      currency: "usd",
      lineItems: [
        { priceId: "42", quantity: 1, itemId: "", chargedAmount: 5000 },
      ],
      paymentId: "1",
    });
  });

  test("a fractional total (currency-rate conversion artifact) rounds to an integer minor unit", () => {
    const event = {
      meta: {
        event_name: "order_created",
        custom_data: { account_id: "acct_a" },
      },
      data: {
        type: "orders",
        id: "2",
        attributes: {
          total: 1499.985,
          currency: "EUR",
          first_order_item: { variant_id: 7 },
        },
      },
    } as Parameters<typeof parseLemonSqueezyEvent>[0];
    const parsed = parseLemonSqueezyEvent(event);
    expect(parsed && "amountTotal" in parsed && parsed.amountTotal).toBe(1500);
  });

  test("subscription_created carries the account id", () => {
    const event = {
      meta: {
        event_name: "subscription_created",
        custom_data: { account_id: "acct_a" },
      },
      data: { type: "subscriptions", id: "9", attributes: {} },
    } as Parameters<typeof parseLemonSqueezyEvent>[0];
    expect(parseLemonSqueezyEvent(event)).toEqual({
      type: "subscription.created",
      sourceEventId: "subscriptions:9",
      accountId: "acct_a",
    });
  });

  test("subscription_cancelled carries the subscription id", () => {
    const event = {
      meta: {
        event_name: "subscription_cancelled",
        custom_data: { account_id: "acct_a" },
      },
      data: { type: "subscriptions", id: "9", attributes: {} },
    } as Parameters<typeof parseLemonSqueezyEvent>[0];
    expect(parseLemonSqueezyEvent(event)).toEqual({
      type: "subscription.canceled",
      sourceEventId: "subscriptions:9",
      accountId: "acct_a",
      subscriptionId: "9",
    });
  });

  test("subscription_payment_success (initial) maps billingReason=subscription_create", () => {
    const event = {
      meta: {
        event_name: "subscription_payment_success",
        custom_data: { account_id: "acct_a" },
      },
      data: {
        type: "subscription-invoices",
        id: "646575",
        attributes: {
          total: 5782,
          currency: "USD",
          subscription_id: 207468,
          billing_reason: "initial",
        },
      },
    } as Parameters<typeof parseLemonSqueezyEvent>[0];
    const parsed = parseLemonSqueezyEvent(event);
    expect(parsed).toEqual({
      type: "invoice.paid",
      sourceEventId: "subscription-invoices:646575",
      accountId: "acct_a",
      amountTotal: 5782,
      currency: "usd",
      subscriptionId: "207468",
      priceId: "",
      billingReason: "subscription_create",
      invoiceId: "646575",
    });
  });

  test("subscription_payment_success renewal maps billingReason=subscription_cycle", () => {
    const event = {
      meta: {
        event_name: "subscription_payment_success",
        custom_data: { account_id: "acct_a" },
      },
      data: {
        type: "subscription-invoices",
        id: "646576",
        attributes: {
          total: 4900,
          currency: "USD",
          subscription_id: 207468,
          billing_reason: "renewal",
        },
      },
    } as Parameters<typeof parseLemonSqueezyEvent>[0];
    const parsed = parseLemonSqueezyEvent(event);
    expect(parsed && "billingReason" in parsed && parsed.billingReason).toBe(
      "subscription_cycle",
    );
  });

  test("order_refunded -> refund.completed (fullyRefunded from the boolean flag)", () => {
    const event = {
      meta: {
        event_name: "order_refunded",
        custom_data: { account_id: "acct_a" },
      },
      data: {
        type: "orders",
        id: "1",
        attributes: { total: 5000, currency: "USD", refunded: true },
      },
    } as Parameters<typeof parseLemonSqueezyEvent>[0];
    expect(parseLemonSqueezyEvent(event)).toEqual({
      type: "refund.completed",
      sourceEventId: "orders:1",
      accountId: "acct_a",
      paymentId: "1",
      amountRefunded: 5000,
      currency: "usd",
      fullyRefunded: true,
      adjustmentId: "",
      items: [],
    });
  });

  // The credit grant keys idempotency on `sourceEventId` (ADR-0007: exactly-once). LemonSqueezy retries
  // a delivery with a fresh `meta.webhook_id`, so the key must NOT vary with it — it derives from the
  // stable resource `type:id` composite, and two different orders must yield two different keys.
  test("a retry with a different meta.webhook_id yields the SAME idempotency key (webhook_id ignored)", () => {
    const make = (webhookId: string) =>
      ({
        meta: {
          event_name: "order_created",
          custom_data: { account_id: "acct_a" },
          webhook_id: webhookId,
        },
        data: {
          type: "orders",
          id: "77",
          attributes: {
            total: 5000,
            currency: "USD",
            first_order_item: { variant_id: 42 },
          },
        },
      }) as Parameters<typeof parseLemonSqueezyEvent>[0];
    const first = parseLemonSqueezyEvent(make("wh_delivery_1"));
    const retry = parseLemonSqueezyEvent(make("wh_delivery_2"));
    expect(first?.sourceEventId).toBe("orders:77");
    expect(retry?.sourceEventId).toBe(first?.sourceEventId);
  });

  test("two different orders yield two distinct idempotency keys", () => {
    const make = (id: string) =>
      ({
        meta: {
          event_name: "order_created",
          custom_data: { account_id: "acct_a" },
          webhook_id: `wh_${id}`,
        },
        data: {
          type: "orders",
          id,
          attributes: {
            total: 5000,
            currency: "USD",
            first_order_item: { variant_id: 42 },
          },
        },
      }) as Parameters<typeof parseLemonSqueezyEvent>[0];
    const a = parseLemonSqueezyEvent(make("100"));
    const b = parseLemonSqueezyEvent(make("200"));
    expect(a?.sourceEventId).toBe("orders:100");
    expect(b?.sourceEventId).toBe("orders:200");
    expect(a?.sourceEventId).not.toBe(b?.sourceEventId);
  });

  test("an unhandled event type maps to null", () => {
    const event = {
      meta: { event_name: "license_key_created" },
      data: { type: "license-keys", id: "1", attributes: {} },
    } as Parameters<typeof parseLemonSqueezyEvent>[0];
    expect(parseLemonSqueezyEvent(event)).toBeNull();
  });

  test("verifyAndParse ties verification + mapping behind the port", () => {
    const billing = createLemonSqueezyBilling({
      apiKey: "ls_test_key",
      webhookSecret: SECRET,
      storeId: "store_1",
    });
    const out = billing.verifyAndParse(orderBody, signed(orderBody));
    expect(out).toMatchObject({
      type: "purchase.completed",
      accountId: "acct_a",
    });
  });
});

describe("LemonSqueezyEventSchema (envelope boundary validation)", () => {
  test("accepts a well-formed envelope", () => {
    const result = LemonSqueezyEventSchema.safeParse({
      meta: { event_name: "order_created" },
      data: { type: "orders", id: "1", attributes: {} },
    });
    expect(result.success).toBe(true);
  });

  test("rejects an envelope with an unexpected extra top-level field", () => {
    const result = LemonSqueezyEventSchema.safeParse({
      meta: { event_name: "order_created" },
      data: { type: "orders", id: "1", attributes: {} },
      webhook_id: "not-top-level", // LemonSqueezy nests this under `meta`, not top-level
    });
    expect(result.success).toBe(false);
  });

  test("rejects an envelope missing meta.event_name", () => {
    expect(
      LemonSqueezyEventSchema.safeParse({ meta: {}, data: {} }).success,
    ).toBe(false);
  });

  test("verifyAndParse rejects a signed body carrying an unexpected extra top-level field", () => {
    const extraFieldBody = JSON.stringify({
      meta: {
        event_name: "order_created",
        custom_data: { account_id: "acct_a" },
      },
      data: {
        type: "orders",
        id: "1",
        attributes: { total: 5000, currency: "usd" },
      },
      test_mode: true, // real LemonSqueezy nests this under `meta`, not top-level
    });
    const billing = createLemonSqueezyBilling({
      apiKey: "ls_test_key",
      webhookSecret: SECRET,
      storeId: "store_1",
    });
    expect(() =>
      billing.verifyAndParse(extraFieldBody, signed(extraFieldBody)),
    ).toThrow(ValidationError);
  });
});

describe("createCheckout — LemonSqueezy JSON:API hosted checkout", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("posts the store/variant relationships + custom_data and returns the checkout url", async () => {
    let body = "";
    let url = "";
    globalThis.fetch = (async (reqUrl: unknown, init?: { body?: string }) => {
      url = String(reqUrl);
      body = init?.body ?? "";
      return new Response(
        JSON.stringify({ data: { attributes: { url: "https://ls.test/c" } } }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    const billing = createLemonSqueezyBilling({
      apiKey: "ls_test_key",
      webhookSecret: SECRET,
      storeId: "store_1",
    });
    const result = await billing.createCheckout({
      accountId: "acct_a",
      priceId: "variant_x",
      mode: "payment",
      successUrl: "https://app.test/ok",
      cancelUrl: "https://app.test/no",
    });
    expect(result.url).toBe("https://ls.test/c");
    expect(url).toBe("https://api.lemonsqueezy.com/v1/checkouts");
    const parsed = JSON.parse(body) as {
      data: {
        attributes: { checkout_data: { custom: { account_id: string } } };
        relationships: {
          store: { data: { id: string } };
          variant: { data: { id: string } };
        };
      };
    };
    expect(parsed.data.attributes.checkout_data.custom.account_id).toBe(
      "acct_a",
    );
    expect(parsed.data.relationships.store.data.id).toBe("store_1");
    expect(parsed.data.relationships.variant.data.id).toBe("variant_x");
  });

  test("throws when LemonSqueezy returns no checkout url", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ data: {} }), {
        status: 200,
      })) as unknown as typeof fetch;
    const billing = createLemonSqueezyBilling({
      apiKey: "ls_test_key",
      webhookSecret: SECRET,
      storeId: "store_1",
    });
    await expect(
      billing.createCheckout({
        accountId: "acct_a",
        priceId: "variant_x",
        mode: "payment",
        successUrl: "https://app.test/ok",
        cancelUrl: "https://app.test/no",
      }),
    ).rejects.toThrow("LemonSqueezy returned no checkout url");
  });
});

describe("createLemonSqueezyBilling — fail-closed config", () => {
  test("throws ConfigError when a required config value is missing", () => {
    expect(() =>
      createLemonSqueezyBilling({
        apiKey: "",
        webhookSecret: SECRET,
        storeId: "s",
      }),
    ).toThrow("createLemonSqueezyBilling requires `apiKey`");
  });
});

import { afterEach, expect, test } from "bun:test";
import { createPaddleCartTransaction } from "./paddle-cart-transaction.ts";
import { MODULE_CATALOG } from "./catalog.ts";
const previousKey = process.env.PADDLE_API_KEY;
const previousEnv = process.env.PADDLE_ENV;
afterEach(() => {
  if (previousKey === undefined) delete process.env.PADDLE_API_KEY;
  else process.env.PADDLE_API_KEY = previousKey;
  if (previousEnv === undefined) delete process.env.PADDLE_ENV;
  else process.env.PADDLE_ENV = previousEnv;
});
const txn = `txn_${"a".repeat(26)}`;
const discount = `dsc_${"b".repeat(26)}`;
const input = {
  priceIds: [MODULE_CATALOG[0]!.priceId],
  accountId: "verified-account",
};

test("Paddle receives server-selected lines and account with bounded redirect-free requests", async () => {
  process.env.PADDLE_API_KEY = "test-only-fake-key";
  process.env.PADDLE_ENV = "sandbox";
  const calls: { url: string; init?: RequestInit }[] = [];
  const result = await createPaddleCartTransaction(
    { ...input, promoCode: "SAVE10" },
    async (url, init, opts) => {
      calls.push({ url: String(url), ...(init ? { init } : {}) });
      expect(opts?.timeoutMs).toBe(15_000);
      expect(init?.redirect).toBe("error");
      return Response.json(
        calls.length === 1
          ? {
              data: [
                {
                  id: discount,
                  code: "save10",
                  status: "active",
                  enabled_for_checkout: true,
                },
              ],
            }
          : { data: { id: txn } },
      );
    },
  );
  expect(result).toBe(txn);
  expect(calls[0]!.url).toBe(
    "https://sandbox-api.paddle.com/discounts?code=SAVE10&status=active",
  );
  expect(calls[1]!.url).toBe("https://sandbox-api.paddle.com/transactions");
  expect(JSON.parse(String(calls[1]!.init?.body))).toEqual({
    collection_mode: "automatic",
    items: [{ price_id: input.priceIds[0], quantity: 1 }],
    custom_data: { account_id: "verified-account" },
    discount_id: discount,
  });
});

test("unavailable or private discount never creates a transaction", async () => {
  process.env.PADDLE_API_KEY = "test-only-fake-key";
  let calls = 0;
  await expect(
    createPaddleCartTransaction({ ...input, promoCode: "SAVE10" }, async () => {
      calls++;
      return Response.json({
        data: [
          {
            id: discount,
            code: "SAVE10",
            status: "active",
            enabled_for_checkout: false,
          },
        ],
      });
    }),
  ).rejects.toThrow("Discount unavailable");
  expect(calls).toBe(1);
});

test("missing server key fails closed before egress", async () => {
  delete process.env.PADDLE_API_KEY;
  await expect(
    createPaddleCartTransaction(input, async () => {
      throw new Error("must not fetch");
    }),
  ).rejects.toThrow("not configured");
});

test("provider errors and malformed transaction ids fail closed", async () => {
  process.env.PADDLE_API_KEY = "test-only-fake-key";
  for (const response of [
    new Response("private provider detail", { status: 503 }),
    Response.json({ data: { id: "not-a-transaction" } }),
  ]) {
    await expect(
      createPaddleCartTransaction(input, async () => response),
    ).rejects.toThrow();
  }
});

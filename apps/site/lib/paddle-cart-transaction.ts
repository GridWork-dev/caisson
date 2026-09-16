// Server-only Paddle transaction creation. Secrets never cross the client boundary.
// API contracts: developer.paddle.com/api-reference/{transactions/create-transaction,discounts/list-discounts}
import { z } from "zod";
import { fetchWithTimeout } from "@caisson/kernel";

const inputSchema = z
  .object({
    priceIds: z
      .array(z.string().regex(/^pri_[a-z0-9]{26}$/))
      .min(1)
      .max(50),
    accountId: z.string().trim().min(1).max(256),
    promoCode: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
  })
  .strict();
// Third-party responses tolerate additive provider fields, validating only consumed fields.
const transactionSchema = z.object({
  data: z.object({ id: z.string().regex(/^txn_[a-z0-9]{26}$/) }),
});
const discountsSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().regex(/^dsc_[a-z0-9]{26}$/),
      code: z.string().nullable(),
      status: z.string(),
      enabled_for_checkout: z.boolean(),
    }),
  ),
});

export async function createPaddleCartTransaction(
  raw: z.infer<typeof inputSchema>,
  fetchImpl: typeof fetchWithTimeout = fetchWithTimeout,
): Promise<string> {
  const input = inputSchema.parse(raw);
  const key = process.env.PADDLE_API_KEY;
  if (!key) throw new Error("Checkout is not configured");
  const base =
    process.env.PADDLE_ENV === "production"
      ? "https://api.paddle.com"
      : "https://sandbox-api.paddle.com";
  const headers = {
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };
  let discountId: string | undefined;
  if (input.promoCode !== undefined) {
    const url = new URL(`${base}/discounts`);
    url.searchParams.set("code", input.promoCode);
    url.searchParams.set("status", "active");
    const response = await fetchImpl(
      url.toString(),
      { headers, redirect: "error" },
      { timeoutMs: 15_000 },
    );
    if (!response.ok) throw new Error("Discount lookup unavailable");
    const discounts = discountsSchema.parse(await response.json()).data;
    const matches = discounts.filter(
      (item) =>
        item.status === "active" &&
        item.enabled_for_checkout &&
        item.code?.toLowerCase() === input.promoCode?.toLowerCase(),
    );
    if (matches.length !== 1) throw new Error("Discount unavailable");
    discountId = matches[0]!.id;
  }
  const response = await fetchImpl(
    `${base}/transactions`,
    {
      method: "POST",
      headers,
      redirect: "error",
      body: JSON.stringify({
        collection_mode: "automatic",
        items: input.priceIds.map((price_id) => ({ price_id, quantity: 1 })),
        custom_data: { account_id: input.accountId },
        ...(discountId === undefined ? {} : { discount_id: discountId }),
      }),
    },
    { timeoutMs: 15_000 },
  );
  if (!response.ok) throw new Error("Transaction creation unavailable");
  return transactionSchema.parse(await response.json()).data.id;
}

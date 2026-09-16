import { expect, test } from "bun:test";
import {
  cartCheckoutHandler,
  type CartRouteDependencies,
} from "./cart-routes.ts";
import { MODULE_CATALOG } from "./catalog.ts";

const ownedItem = MODULE_CATALOG[0]!;
const newItem = MODULE_CATALOG[1]!;
const transactionId = `txn_${"a".repeat(26)}`;
function fixture(overrides: Partial<CartRouteDependencies> = {}) {
  const calls: Parameters<CartRouteDependencies["createTransaction"]>[0][] = [];
  const accounts: string[] = [];
  const handler = cartCheckoutHandler({
    session: async () => ({
      accountId: "verified-account",
      userId: "buyer",
      role: "owner",
    }),
    owned: async (id) => {
      accounts.push(id);
      return new Set([ownedItem.id]);
    },
    createTransaction: async (input) => {
      calls.push(input);
      return transactionId;
    },
    ...overrides,
  });
  return { handler, calls, accounts };
}
const request = (body: unknown, origin = "https://caisson.sh") =>
  new Request("https://caisson.sh/api/cart/checkout", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

test("already-owned checkout lines are dropped before Paddle receives current catalog prices", async () => {
  const f = fixture();
  const response = await f.handler(
    request({
      itemIds: [ownedItem.id, newItem.id, newItem.id],
      promoCode: "SAVE10",
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    transactionId,
    removed: [ownedItem.id],
  });
  expect(f.accounts).toEqual(["verified-account"]);
  expect(f.calls).toEqual([
    {
      accountId: "verified-account",
      priceIds: [newItem.priceId],
      promoCode: "SAVE10",
    },
  ]);
});

test("an all-owned cart never reaches Paddle", async () => {
  const f = fixture();
  expect((await f.handler(request({ itemIds: [ownedItem.id] }))).status).toBe(
    409,
  );
  expect(f.calls).toEqual([]);
});

test("forged hint without a session cannot create checkout", async () => {
  const f = fixture({ session: async () => null });
  const req = request({ itemIds: [newItem.id] });
  req.headers.set("cookie", "caisson_sess_hint=1");
  expect((await f.handler(req)).status).toBe(401);
  expect(f.calls).toEqual([]);
  expect(f.accounts).toEqual([]);
});

test("client account, price and quantity injection and unknown catalog items fail before Paddle", async () => {
  const f = fixture();
  for (const body of [
    { itemIds: [newItem.id], accountId: "other" },
    { itemIds: [newItem.id], priceIds: [ownedItem.priceId] },
    { itemIds: [newItem.id], quantity: 2 },
    { itemIds: ["module:unknown"] },
    { itemIds: [] },
    { itemIds: [newItem.id], promoCode: "bad&query" },
  ])
    expect((await f.handler(request(body))).status).toBe(400);
  expect(f.calls).toEqual([]);
});

test("failed entitlement read blocks transaction creation", async () => {
  const f = fixture({
    owned: async () => {
      throw new Error("DB unavailable");
    },
  });
  expect((await f.handler(request({ itemIds: [newItem.id] }))).status).toBe(
    503,
  );
  expect(f.calls).toEqual([]);
});

test("cross-origin checkout is rejected before session or payment work", async () => {
  const f = fixture({
    session: async () => {
      throw new Error("must not read");
    },
  });
  expect(
    (
      await f.handler(
        request({ itemIds: [newItem.id] }, "https://attacker.example"),
      )
    ).status,
  ).toBe(403);
  expect(f.calls).toEqual([]);
});

test("production checkout route binds session, scoped ownership and server transaction creation", async () => {
  const source = await Bun.file(
    new URL("../app/api/cart/checkout/route.ts", import.meta.url),
  ).text();
  for (const binding of [
    "session: getSession",
    "owned: getOwnedCartItemIdsForAccount",
    "createTransaction: createPaddleCartTransaction",
  ])
    expect(source).toContain(binding);
  const panel = await Bun.file(
    new URL("../components/cart-checkout-panel.tsx", import.meta.url),
  ).text();
  expect(panel).toContain('"/api/cart/checkout"');
  expect(panel).toContain("openCartTransaction(parsed.data.transactionId)");
  expect(panel).not.toContain("openCartCheckout(");
});

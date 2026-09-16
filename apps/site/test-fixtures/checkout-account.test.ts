// Run only through lib/checkout-account.test.ts; these doubles must not escape this process.
import { beforeEach, expect, mock, test } from "bun:test";
import * as realAuth from "@caisson/auth";
import * as realServer from "../lib/auth-server.ts";
import * as realDb from "../lib/db.ts";
import * as realOwned from "../lib/owned-cart-items.ts";
import * as realPaddle from "../lib/paddle-cart-transaction.ts";
import { MODULE_CATALOG } from "../lib/catalog.ts";

let requestedAccount: string | undefined;
let failure = false;
let sessionFailure = false;
let signedIn = true;
let memberships: realAuth.AccountMembership[];
let ownedCalls: string[];
let transactionCalls: string[];
mock.module("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: (name: string) =>
      name === "cs_active_account" && requestedAccount !== undefined
        ? { name, value: requestedAccount }
        : undefined,
  }),
}));
mock.module("../lib/auth-server.ts", () => ({
  ...realServer,
  getAuth: async () => ({
    api: {
      getSession: async () => {
        if (sessionFailure) throw new Error("session unavailable");
        return signedIn ? { user: { id: "buyer" } } : null;
      },
    },
  }),
}));
mock.module("../lib/db.ts", () => ({ ...realDb, getDb: async () => ({}) }));
mock.module("@caisson/auth", () => ({
  ...realAuth,
  resolveUserAccounts: async () => {
    if (failure) throw new Error("membership resolution failed");
    return memberships;
  },
  ensurePersonalAccount: async () => undefined,
}));
mock.module("../lib/owned-cart-items.ts", () => ({
  ...realOwned,
  getOwnedCartItemIdsForAccount: async (id: string) => {
    ownedCalls.push(id);
    return new Set<string>();
  },
}));
mock.module("../lib/paddle-cart-transaction.ts", () => ({
  ...realPaddle,
  createPaddleCartTransaction: async (input: { accountId: string }) => {
    transactionCalls.push(input.accountId);
    return `txn_${"a".repeat(26)}`;
  },
}));

// Import the actual route and both actual session resolvers after boundary doubles are installed.
const { POST } = await import("../app/api/cart/checkout/route.ts");
const { getSession } = await import("../lib/auth.ts");
const request = () =>
  new Request("https://caisson.sh/api/cart/checkout", {
    method: "POST",
    headers: {
      origin: "https://caisson.sh",
      "content-type": "application/json",
    },
    body: JSON.stringify({ itemIds: [MODULE_CATALOG[0]!.id] }),
  });
beforeEach(() => {
  requestedAccount = "org";
  failure = false;
  sessionFailure = false;
  signedIn = true;
  memberships = [
    { accountId: "buyer", userId: "buyer", role: "owner" },
    { accountId: "org", userId: "buyer", role: "seat" },
  ];
  ownedCalls = [];
  transactionCalls = [];
});
test("selected organization membership failure reaches neither entitlements nor Paddle", async () => {
  failure = true;
  const result = await POST(request());
  expect(result.status).toBe(503);
  expect(await result.json()).toEqual({ error: "checkout unavailable" });
  expect(ownedCalls).toEqual([]);
  expect(transactionCalls).toEqual([]);
});
test("dashboard preserves its personal-account availability fallback", async () => {
  failure = true;
  expect(await getSession()).toEqual({
    userId: "buyer",
    accountId: "buyer",
    role: "owner",
  });
});
test("verified organization is used for both entitlement and transaction scopes", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(ownedCalls).toEqual(["org"]);
  expect(transactionCalls).toEqual(["org"]);
});
test("an explicit unverified account never silently falls back for commerce", async () => {
  requestedAccount = "stale-or-forged";
  expect((await POST(request())).status).toBe(503);
  expect(ownedCalls).toEqual([]);
  expect(transactionCalls).toEqual([]);
});
test("session-provider errors are inside the checkout failure boundary", async () => {
  sessionFailure = true;
  expect((await POST(request())).status).toBe(503);
  expect(ownedCalls).toEqual([]);
  expect(transactionCalls).toEqual([]);
});
test("no verified session stays unauthorized", async () => {
  signedIn = false;
  expect((await POST(request())).status).toBe(401);
  expect(ownedCalls).toEqual([]);
  expect(transactionCalls).toEqual([]);
});
test("verified personal membership works without an account preference", async () => {
  requestedAccount = undefined;
  expect((await POST(request())).status).toBe(200);
  expect(ownedCalls).toEqual(["buyer"]);
  expect(transactionCalls).toEqual(["buyer"]);
});
test("empty membership after bootstrap cannot create a checkout", async () => {
  memberships = [];
  requestedAccount = undefined;
  expect((await POST(request())).status).toBe(503);
  expect(ownedCalls).toEqual([]);
  expect(transactionCalls).toEqual([]);
});

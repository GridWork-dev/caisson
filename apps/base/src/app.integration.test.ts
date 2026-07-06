// P1 exit-gate capstone: the base reference app RUNS over real HTTP and composes every base
// package — auth (JWT) → tenancy (RLS) → credits (402/grant) → billing (webhook) → MCP. Proves
// "base app runs; RLS-scoped credit debit is 402 then succeeds after a verified webhook grant;
// the buyer MCP answers an authed query."
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { newTestPg, type TestPg } from "@caisson/testing";
import { generateAccountKeyPair, signAccountJwt } from "@caisson/auth";
import {
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
} from "@caisson/credits";
import { RATE_LIMIT_SCHEMA_SQL } from "@caisson/rate-limit";
import { createStripeBilling } from "@caisson/billing-orchestration";
import { loadRegistryIndex } from "@caisson/registry";
import { createBaseApp, createFetchHandler } from "./index.ts";

// This capstone exercises only the authed MCP read (`list_modules`), which never touches the
// registry index — a minimal valid (empty) index satisfies the new `index` option.
const EMPTY_INDEX = loadRegistryIndex({ schemaVersion: 1, modules: [] });

const WEBHOOK_SECRET = "whsec_base_test";
const keys = generateAccountKeyPair();
let tp: TestPg;
let server: ReturnType<typeof Bun.serve>;
let base: string;

function stripeSigned(body: string): string {
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", WEBHOOK_SECRET)
    .update(`${t}.${body}`)
    .digest("hex");
  return `t=${t},v1=${sig}`;
}

function authHeader(): string {
  const jwt = signAccountJwt(
    { userId: "u1", accountId: "acct_a", role: "owner" },
    keys.privateKey,
  );
  return `Bearer ${jwt}`;
}

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(CREDIT_SCHEMA_SQL);
  await tp.exec(CREDIT_ROUNDING_MIGRATION_SQL);
  // The buyer MCP is now rate-limit-throttled BY DEFAULT (ADR-0112) — provision the token-bucket
  // table so the capstone exercises the REAL throttle (allow path) instead of silently failing open.
  await tp.exec(RATE_LIMIT_SCHEMA_SQL);
  const app = createBaseApp({
    db: tp.pg,
    billing: createStripeBilling({
      webhookSecret: WEBHOOK_SECRET,
      apiKey: "sk_test",
    }),
    mcp: {
      tokens: [
        {
          token: "mcp_tok_acct_a_000000",
          accountId: "acct_a",
          entitlements: ["compliance", "auth"],
        },
      ],
      index: EMPTY_INDEX,
      onGenerate: async () => ({ generationId: "gen_1" }),
    },
  });
  server = Bun.serve({
    port: 0,
    fetch: createFetchHandler({ app, authPublicKey: keys.publicKey }),
  });
  base = `http://localhost:${server.port}`;
});

afterAll(async () => {
  server.stop(true);
  await tp.close();
});

const purchaseBody = JSON.stringify({
  id: "evt_base_1",
  type: "checkout.session.completed",
  data: {
    object: {
      amount_total: 89900,
      currency: "usd",
      metadata: { account_id: "acct_a" },
    },
  },
});

async function post(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("base reference app (HTTP)", () => {
  test("spending with no credits is 402", async () => {
    const res = await post(
      "/spend",
      { amount: 100, idempotencyKey: "k1" },
      { authorization: authHeader() },
    );
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({
      error: {
        code: "insufficient_credits",
        message: "Insufficient credits",
        details: { required: 100, balance: 0 },
      },
    });
  });

  test("a verified Stripe webhook grants credits", async () => {
    const res = await post("/webhooks/stripe", purchaseBody, {
      "stripe-signature": stripeSigned(purchaseBody),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ handled: true, credits: 899 });
  });

  test("after the grant, the same spend succeeds and decrements", async () => {
    const res = await post(
      "/spend",
      { amount: 100, idempotencyKey: "k2" },
      { authorization: authHeader() },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ balance: 799, idempotent: false });
  });

  test("the buyer MCP answers an authed query", async () => {
    const res = await post(
      "/mcp",
      { tool: "list_modules" },
      { authorization: "Bearer mcp_tok_acct_a_000000" },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      result: { modules: ["auth", "compliance"] },
    });
  });

  test("a request with no session is 401", async () => {
    const res = await post("/spend", { amount: 1, idempotencyKey: "k3" });
    expect(res.status).toBe(401);
  });
});

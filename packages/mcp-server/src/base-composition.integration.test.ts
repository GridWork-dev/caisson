// P1 exit-gate capstone: the base packages compose over real HTTP — auth (JWT) → tenancy (RLS) →
// credits (402/grant) → billing (webhook) → MCP. The retired reference app was only a composition
// host; this package-owned fixture keeps the same package-seam proof without retaining runtime code.
import { createHmac, type KeyObject } from "node:crypto";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
// PGlite under CI runner load regularly crosses the 5s default; repo-wide standard treatment.
setDefaultTimeout(30_000);
import { newTestPg, type TestPg } from "@caisson/testing";
import {
  generateAccountKeyPair,
  signAccountJwt,
  verifyAccountJwt,
  type SessionContext,
} from "@caisson/auth";
import {
  CREDIT_EXPIRY_MIGRATION_SQL,
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
  GRANT_CONSUMPTION_MIGRATION_SQL,
  balance,
  debit,
  grant,
  type CreditResult,
} from "@caisson/credits";
import type { BillingProvider } from "@caisson/billing";
import { createStripeBilling } from "@caisson/billing-orchestration";
import {
  AuthnError,
  asCredits,
  parseStrict,
  toErrorResponse,
} from "@caisson/kernel";
import { loadRegistryIndex } from "@caisson/registry-schema";
import { withTenant, type Transactor } from "@caisson/tenancy-rls";
import { z } from "zod";
import { createMcpServer, type McpServerOptions } from "./index.ts";

interface ReferenceAppDeps {
  db: Transactor;
  billing: BillingProvider;
  mcp: McpServerOptions;
}

interface SpendInput {
  amount: number;
  idempotencyKey: string;
}

interface ReferenceApp {
  spend(session: SessionContext, input: SpendInput): Promise<CreditResult>;
  balanceFor(session: SessionContext): Promise<number>;
  handleStripeWebhook(
    rawBody: string,
    signature: string,
  ): Promise<{ handled: boolean; credits: number }>;
  mcpQuery(bearer: string, tool: string, args: unknown): Promise<unknown>;
}

function createReferenceApp(deps: ReferenceAppDeps): ReferenceApp {
  const mcp = createMcpServer(deps.mcp);
  return {
    spend(session, input) {
      return withTenant(deps.db, session.accountId, (tx) =>
        debit(tx, {
          accountId: session.accountId,
          amount: asCredits(input.amount),
          eventType: "ai_feature_debit",
          idempotencyKey: input.idempotencyKey,
        }),
      );
    },
    balanceFor(session) {
      return withTenant(deps.db, session.accountId, (tx) =>
        balance(tx, session.accountId),
      );
    },
    async handleStripeWebhook(rawBody, signature) {
      const event = deps.billing.verifyAndParse(rawBody, signature);
      if (event?.type !== "purchase.completed") {
        return { handled: false, credits: 0 };
      }
      const credits = asCredits(Math.floor(event.amountTotal / 100));
      await withTenant(deps.db, event.accountId, (tx) =>
        grant(tx, {
          accountId: event.accountId,
          amount: credits,
          eventType: "purchase",
          sourceEventId: event.sourceEventId,
        }),
      );
      return { handled: true, credits };
    },
    mcpQuery(bearer, tool, args) {
      const session = mcp.authenticate(bearer);
      return mcp.handleToolCall(session, tool, args);
    },
  };
}

const SpendBodySchema = z
  .object({
    amount: z.number().int().positive(),
    idempotencyKey: z.string().trim().min(1).max(256),
  })
  .strict();

const McpBodySchema = z
  .object({
    tool: z.string().trim().min(1).max(128),
    args: z.unknown().optional(),
  })
  .strict();

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    },
  });
}

function bearer(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (header === null || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

function createFetchHandler(deps: {
  app: ReferenceApp;
  authPublicKey: KeyObject;
}): (req: Request) => Promise<Response> {
  return async (req) => {
    const url = new URL(req.url);
    try {
      if (req.method === "POST" && url.pathname === "/spend") {
        const token = bearer(req);
        if (token === null) throw new AuthnError();
        const session = verifyAccountJwt(token, deps.authPublicKey);
        const body = parseStrict(SpendBodySchema, await req.json());
        return json(200, await deps.app.spend(session, body));
      }
      if (req.method === "POST" && url.pathname === "/webhooks/stripe") {
        const signature = req.headers.get("stripe-signature") ?? "";
        return json(
          200,
          await deps.app.handleStripeWebhook(await req.text(), signature),
        );
      }
      if (req.method === "POST" && url.pathname === "/mcp") {
        const token = bearer(req) ?? "";
        const body = parseStrict(McpBodySchema, await req.json());
        return json(200, {
          result: await deps.app.mcpQuery(token, body.tool, body.args ?? {}),
        });
      }
      return json(404, { error: { code: "not_found", message: "Not found" } });
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return json(status, body);
    }
  };
}

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
  await tp.exec(CREDIT_EXPIRY_MIGRATION_SQL);
  await tp.exec(GRANT_CONSUMPTION_MIGRATION_SQL);
  const app = createReferenceApp({
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

describe("base package composition (HTTP)", () => {
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

  test("the MCP server answers an authed query", async () => {
    const res = await post(
      "/mcp",
      { tool: "list_modules" },
      { authorization: "Bearer mcp_tok_acct_a_000000" },
    );
    expect(res.status).toBe(200);
    // The fixture wires an empty registry index, so the catalog listing is empty.
    expect(await res.json()).toEqual({ result: { modules: [] } });
  });

  test("a request with no session is 401", async () => {
    const res = await post("/spend", { amount: 1, idempotencyKey: "k3" });
    expect(res.status).toBe(401);
  });
});

function unreachableApp(): ReferenceApp {
  const unreachable = (): never => {
    throw new Error(
      "app method reached — Zod validation should have rejected the body first",
    );
  };
  return {
    spend: unreachable,
    balanceFor: unreachable,
    handleStripeWebhook: unreachable,
    mcpQuery: unreachable,
  };
}

function request(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("package-composition HTTP Zod boundaries", () => {
  const handler = createFetchHandler({
    app: unreachableApp(),
    authPublicKey: keys.publicKey,
  });

  test("/spend rejects an extra field instead of silently dropping it", async () => {
    const res = await handler(
      request(
        "/spend",
        { amount: 100, idempotencyKey: "k1", role: "admin" },
        { authorization: authHeader() },
      ),
    );
    expect(res.status).toBe(400);
  });

  test("/spend rejects a non-positive amount", async () => {
    const res = await handler(
      request(
        "/spend",
        { amount: -1, idempotencyKey: "k1" },
        { authorization: authHeader() },
      ),
    );
    expect(res.status).toBe(400);
  });

  test("/spend rejects a missing idempotencyKey", async () => {
    const res = await handler(
      request("/spend", { amount: 100 }, { authorization: authHeader() }),
    );
    expect(res.status).toBe(400);
  });

  test("/mcp rejects a non-string tool", async () => {
    const res = await handler(
      request("/mcp", { tool: 42 }, { authorization: "Bearer whatever" }),
    );
    expect(res.status).toBe(400);
  });

  test("/mcp rejects an extra field", async () => {
    const res = await handler(
      request(
        "/mcp",
        { tool: "list_modules", extra: true },
        { authorization: "Bearer whatever" },
      ),
    );
    expect(res.status).toBe(400);
  });
});

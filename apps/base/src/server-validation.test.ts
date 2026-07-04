// Zod `.strict()` boundary test for /spend and /mcp (finding be4c8e41681647152, P2/D1 Task 3). Both
// bodies used to parse via a bare `as` cast — any shape sailed through. `parseStrict` now rejects
// extra fields and wrong types BEFORE the request reaches `app.spend`/`app.mcpQuery`. No Postgres
// needed: a fake `BaseApp` whose methods throw if called proves rejection happens at the boundary,
// not deeper in the stack, and `createFetchHandler` is exercised directly (no `Bun.serve`).
import { describe, expect, test } from "bun:test";
import { generateAccountKeyPair, signAccountJwt } from "@caisson/auth";
import type { BaseApp } from "./app.ts";
import { createFetchHandler } from "./server.ts";

const keys = generateAccountKeyPair();

function authHeader(): string {
  const jwt = signAccountJwt(
    { userId: "u1", accountId: "acct_a", role: "owner" },
    keys.privateKey,
  );
  return `Bearer ${jwt}`;
}

// Every method throws — the tests assert a 400 is returned WITHOUT any method ever running.
function unreachableApp(): BaseApp {
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

function post(
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

describe("/spend and /mcp Zod boundary (P2/D1 be4c8e41681647152)", () => {
  const handler = createFetchHandler({
    app: unreachableApp(),
    authPublicKey: keys.publicKey,
  });

  test("/spend rejects an extra field instead of silently dropping it", async () => {
    const res = await handler(
      post(
        "/spend",
        { amount: 100, idempotencyKey: "k1", role: "admin" },
        { authorization: authHeader() },
      ),
    );
    expect(res.status).toBe(400);
  });

  test("/spend rejects a non-positive amount", async () => {
    const res = await handler(
      post(
        "/spend",
        { amount: -1, idempotencyKey: "k1" },
        { authorization: authHeader() },
      ),
    );
    expect(res.status).toBe(400);
  });

  test("/spend rejects a missing idempotencyKey", async () => {
    const res = await handler(
      post("/spend", { amount: 100 }, { authorization: authHeader() }),
    );
    expect(res.status).toBe(400);
  });

  test("/mcp rejects a non-string tool", async () => {
    const res = await handler(
      post("/mcp", { tool: 42 }, { authorization: "Bearer whatever" }),
    );
    expect(res.status).toBe(400);
  });

  test("/mcp rejects an extra field", async () => {
    const res = await handler(
      post(
        "/mcp",
        { tool: "list_modules", extra: true },
        { authorization: "Bearer whatever" },
      ),
    );
    expect(res.status).toBe(400);
  });
});

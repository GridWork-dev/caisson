// The server-side Paddle cancel call (ADR-0293 G14): request shape, env-gated base URL, tolerant
// response parse, never-throws contract. Fetch is injected (same pattern as discord-grant.test.ts) —
// no monkeypatched global.
import { afterEach, expect, test } from "bun:test";
import type { fetchWithTimeout } from "@caisson/kernel";
import { cancelPaddleSubscription } from "./paddle-cancel.ts";

type FetchImpl = typeof fetchWithTimeout;

const realEnv = { ...process.env };
afterEach(() => {
  process.env.PADDLE_API_KEY = realEnv.PADDLE_API_KEY;
  process.env.PADDLE_ENV = realEnv.PADDLE_ENV;
});

test("unconfigured (no API key) fails closed without calling fetch", async () => {
  delete process.env.PADDLE_API_KEY;
  let called = false;
  const fake: FetchImpl = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  const result = await cancelPaddleSubscription("sub_1", fake);
  expect(called).toBe(false);
  expect(result).toEqual({
    ok: false,
    reason: "cancellation is not configured",
  });
});

test("posts effective_from=next_billing_period to the sandbox base URL by default, Bearer-authed", async () => {
  process.env.PADDLE_API_KEY = "pdl_test_key";
  delete process.env.PADDLE_ENV;
  const calls: Array<{ url: string; auth: string; body: unknown }> = [];
  const fake: FetchImpl = async (input, init) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: String(input),
      auth: headers.get("authorization") ?? "",
      body: JSON.parse(String(init?.body)),
    });
    return new Response(
      JSON.stringify({
        data: {
          status: "active",
          scheduled_change: { effective_at: "2026-08-01T00:00:00.000Z" },
        },
      }),
      { status: 200 },
    );
  };
  const result = await cancelPaddleSubscription("sub_42", fake);
  expect(calls).toEqual([
    {
      url: "https://sandbox-api.paddle.com/subscriptions/sub_42/cancel",
      auth: "Bearer pdl_test_key",
      body: { effective_from: "next_billing_period" },
    },
  ]);
  expect(result).toEqual({
    ok: true,
    status: "active",
    effectiveAt: "2026-08-01T00:00:00.000Z",
  });
});

test("uses the production base URL when PADDLE_ENV=production", async () => {
  process.env.PADDLE_API_KEY = "pdl_test_key";
  process.env.PADDLE_ENV = "production";
  let capturedUrl = "";
  const fake: FetchImpl = async (input) => {
    capturedUrl = String(input);
    return new Response(JSON.stringify({ data: { status: "active" } }), {
      status: 200,
    });
  };
  await cancelPaddleSubscription("sub_1", fake);
  expect(capturedUrl).toBe("https://api.paddle.com/subscriptions/sub_1/cancel");
});

test("a non-2xx Paddle response resolves ok:false with a generic reason, never echoes the body", async () => {
  process.env.PADDLE_API_KEY = "pdl_test_key";
  const fake: FetchImpl = async () =>
    new Response("account suspended: acct_secret_123", { status: 403 });
  const result = await cancelPaddleSubscription("sub_1", fake);
  expect(result).toEqual({ ok: false, reason: "Paddle returned status 403" });
});

test("a throwing fetch (network/timeout) resolves ok:false, never throws", async () => {
  process.env.PADDLE_API_KEY = "pdl_test_key";
  const fake: FetchImpl = async () => {
    throw new Error("network down");
  };
  const result = await cancelPaddleSubscription("sub_1", fake);
  expect(result).toEqual({
    ok: false,
    reason: "could not reach Paddle to cancel the subscription",
  });
});

test("tolerates a response missing scheduled_change (no schema drift break)", async () => {
  process.env.PADDLE_API_KEY = "pdl_test_key";
  const fake: FetchImpl = async () =>
    new Response(JSON.stringify({ data: { status: "canceled" } }), {
      status: 200,
    });
  const result = await cancelPaddleSubscription("sub_1", fake);
  expect(result).toEqual({ ok: true, status: "canceled", effectiveAt: null });
});

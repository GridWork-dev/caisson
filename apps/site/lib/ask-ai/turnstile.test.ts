// Turnstile fail-closed matrix (ADR-0234 F5). The paid LLM route rejects a missing/invalid token, and
// rejects a missing SECRET in production; a dev/CI instance with no secret bypasses.
import { afterEach, expect, test } from "bun:test";
import { makeTurnstileVerifier } from "./turnstile.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubVerify(status: number, success: boolean): void {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ success }), {
      status,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;
}

test("unconfigured secret FAILS CLOSED in production", async () => {
  const verify = makeTurnstileVerifier({
    secret: undefined,
    isProduction: true,
  });
  expect(await verify("any-token", "1.2.3.4")).toBe(false);
  expect(await verify(undefined, "1.2.3.4")).toBe(false);
});

test("unconfigured secret bypasses in dev/CI (no Cloudflare account needed)", async () => {
  const verify = makeTurnstileVerifier({ secret: "", isProduction: false });
  expect(await verify(undefined, "")).toBe(true);
});

test("configured secret rejects a missing token", async () => {
  const verify = makeTurnstileVerifier({
    secret: "s3cret",
    isProduction: true,
  });
  expect(await verify(undefined, "1.2.3.4")).toBe(false);
  expect(await verify("", "1.2.3.4")).toBe(false);
});

test("configured secret admits only a Cloudflare success:true", async () => {
  const verify = makeTurnstileVerifier({
    secret: "s3cret",
    isProduction: true,
  });
  stubVerify(200, true);
  expect(await verify("good", "1.2.3.4")).toBe(true);
  stubVerify(200, false);
  expect(await verify("bad", "1.2.3.4")).toBe(false);
});

test("configured secret fails closed on a non-2xx or a network/timeout error", async () => {
  const verify = makeTurnstileVerifier({
    secret: "s3cret",
    isProduction: true,
  });
  stubVerify(500, true);
  expect(await verify("tok", "1.2.3.4")).toBe(false);
  globalThis.fetch = (async () => {
    throw new Error("timeout");
  }) as unknown as typeof fetch;
  expect(await verify("tok", "1.2.3.4")).toBe(false);
});

// ADR-0283: `verifyAdminSession`, `requireAdmin`, and `proxy` unit tests, all sharing ONE mock —
// `admin-auth-mock.ts` owns the single `mock.module("./admin-auth-server.ts", ...)` registration
// for the whole suite (see its header for why). Testing `requireAdmin`/`proxy` here too, driven
// through the REAL (unmocked) `admin-session.ts`/`admin-route.ts`, which bottom out at that one
// mock, avoids ever mocking `admin-session.ts` itself — the module `proxy.ts` and `admin-route.ts`
// both import for real. `admin-auth-server.ts`'s OWN logic (env parsing, the databaseHooks gate,
// better-auth wiring) is exercised via admin-auth-config.test.ts + admin-auth-server.pglite.test.ts
// + the real better-auth build (`bunx next build`).
import { createHmac } from "node:crypto";
import { beforeEach, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { setAdminAuthFixture, VERIFIED_ADMIN } from "./admin-auth-mock.ts";

const { verifyAdminSession } = await import("./admin-session.ts");
const { requireAdmin } = await import("./admin-route.ts");
const { proxy, config: proxyConfig } = await import("../proxy.ts");

const REQ = new Request("https://admin.caisson.sh/business");

/** The internal-proof bearer the site issues (F3): "<unix-seconds>.<hmac over ts\naccountId>".
 *  The unbounded pre-F3 form these tests used to build is no longer accepted — see
 *  internal-proof-auth.ts. */
function timestampedCredential(accountId: string, secret: string): string {
  const issuedAtSec = Math.floor(Date.now() / 1000);
  const mac = createHmac("sha256", secret)
    .update(`${issuedAtSec}\n${accountId}`)
    .digest("hex");
  return `${issuedAtSec}.${mac}`;
}

beforeEach(() => {
  setAdminAuthFixture();
});

test("unconfigured runtime (getAdminAuth null) → no verified actor", async () => {
  expect(await verifyAdminSession(REQ)).toBeNull();
});

test("no session → no verified actor", async () => {
  setAdminAuthFixture({
    api: {
      getSession: async () => null,
      listUserAccounts: async () => [],
    },
  });
  expect(await verifyAdminSession(REQ)).toBeNull();
});

test("session exists but no linked GitHub account → denied", async () => {
  setAdminAuthFixture({
    api: {
      getSession: async () => ({ user: { email: "<email>" } }),
      listUserAccounts: async () => [],
    },
  });
  expect(await verifyAdminSession(REQ)).toBeNull();
});

test("linked GitHub account NOT on the allowlist → denied (fail-closed)", async () => {
  setAdminAuthFixture({
    api: {
      getSession: async () => ({ user: { email: "<email>" } }),
      listUserAccounts: async () => [
        { providerId: "github", accountId: "999999" },
      ],
    },
  });
  expect(await verifyAdminSession(REQ)).toBeNull();
});

test("linked GitHub account ON the allowlist → verified actor (session email)", async () => {
  setAdminAuthFixture(VERIFIED_ADMIN);
  expect(await verifyAdminSession(REQ)).toEqual({ email: "<email>" });
});

test("blank session email falls back to the GitHub numeric id, never a blank actor", async () => {
  setAdminAuthFixture({
    api: {
      getSession: async () => ({ user: { email: "  " } }),
      listUserAccounts: async () => [
        { providerId: "github", accountId: "123456" },
      ],
    },
  });
  expect(await verifyAdminSession(REQ)).toEqual({ email: "123456" });
});

test("an empty CURRENT allowlist denies even a previously-valid id (live revocation)", async () => {
  setAdminAuthFixture(VERIFIED_ADMIN, new Set());
  expect(await verifyAdminSession(REQ)).toBeNull();
});

test("a lookup error (bad/forged session, unreachable DB) fails closed, never throws", async () => {
  setAdminAuthFixture({
    api: {
      getSession: async () => {
        throw new Error("boom");
      },
      listUserAccounts: async () => [],
    },
  });
  await expect(verifyAdminSession(REQ)).resolves.toBeNull();
});

// --- requireAdmin (route-level, direct re-verification — security floor, no header trust) -------

test("requireAdmin: no verified session → null (never trusts an inbound x-admin-actor header)", async () => {
  const spoofed = new Request("https://admin.caisson.sh/api/admin/x", {
    headers: { "x-admin-actor": "attacker@evil.example" },
  });
  expect(await requireAdmin(spoofed)).toBeNull();
});

test("requireAdmin: a real verified session returns the actor email from the session, not a header", async () => {
  setAdminAuthFixture(VERIFIED_ADMIN);
  const withDifferentHeader = new Request(
    "https://admin.caisson.sh/api/admin/x",
    {
      headers: { "x-admin-actor": "someone-else@example.com" },
    },
  );
  expect(await requireAdmin(withDifferentHeader)).toBe("<email>");
});

// --- proxy() deny-by-default routing (driven through the real verifyAdminSession above) --------

test("proxy: no verified session on a PAGE route → redirect to /login?next=<path>", async () => {
  const req = new NextRequest("https://admin.caisson.sh/business");
  const res = await proxy(req);
  expect(res.status).toBe(307);
  const location = res.headers.get("location");
  expect(location).not.toBeNull();
  const url = new URL(location as string);
  expect(url.pathname).toBe("/login");
  expect(url.searchParams.get("next")).toBe("/business");
});

test("proxy: no verified session on an API route → 401, no redirect", async () => {
  const req = new NextRequest(
    "https://admin.caisson.sh/api/admin/credit/adjust",
  );
  const res = await proxy(req);
  expect(res.status).toBe(401);
});

test("proxy: a stale session_token cookie is dropped on deny", async () => {
  const req = new NextRequest("https://admin.caisson.sh/business", {
    headers: { cookie: "caisson-admin.session_token=stale; other=1" },
  });
  const res = await proxy(req);
  const setCookie = res.headers.get("set-cookie") ?? "";
  expect(setCookie).toContain("caisson-admin.session_token=");
  expect(setCookie).toContain("Expires=Thu, 01 Jan 1970");
});

test("proxy: a verified session threads x-admin-actor and lets the request through", async () => {
  setAdminAuthFixture(VERIFIED_ADMIN);
  const req = new NextRequest("https://admin.caisson.sh/business");
  const res = await proxy(req);
  expect(res.status).toBe(200);
  // NextResponse.next({ request: { headers } }) signals the rewritten request headers via this
  // `x-middleware-request-*` convention (Next's runtime replays them onto the real downstream
  // request before invoking the route handler) — a plain `x-admin-actor` never appears directly
  // on the middleware's OWN response.
  expect(res.headers.get("x-middleware-request-x-admin-actor")).toBe(
    "<email>",
  );
});

test("proxy: a valid account-bound service HMAC reaches the internal proof route without an admin session", async () => {
  const secret = "test-proof-proxy-secret-with-32-bytes";
  const accountId = "buyer_account_01";
  const credential = timestampedCredential(accountId, secret);
  const originalSecret = process.env.CAISSON_PROOF_PROXY_SECRET;
  const originalHost = process.env.CAISSON_PROOF_PROXY_INTERNAL_HOST;
  process.env.CAISSON_PROOF_PROXY_SECRET = secret;
  process.env.CAISSON_PROOF_PROXY_INTERNAL_HOST = "admin.railway.internal";
  let routeReached = false;

  try {
    const req = new NextRequest(
      "https://admin.railway.internal/api/internal/audit/proof",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${credential}`,
          "content-type": "application/json",
          "x-caisson-account-id": accountId,
        },
        body: JSON.stringify({ seq: 0 }),
      },
    );
    const gate = await proxy(req);
    if (gate.status === 200) routeReached = true;

    expect(gate.status).toBe(200);
    expect(routeReached).toBe(true);
  } finally {
    if (originalSecret === undefined)
      delete process.env.CAISSON_PROOF_PROXY_SECRET;
    else process.env.CAISSON_PROOF_PROXY_SECRET = originalSecret;
    if (originalHost === undefined)
      delete process.env.CAISSON_PROOF_PROXY_INTERNAL_HOST;
    else process.env.CAISSON_PROOF_PROXY_INTERNAL_HOST = originalHost;
  }
});

test("proxy: invalid HMAC or the public admin host cannot enter the internal proof route", async () => {
  const secret = "test-proof-proxy-secret-with-32-bytes";
  const accountId = "buyer_account_01";
  // Deliberately VALID — the public-origin leg below must fail on the host alone, so the
  // credential must not be a second reason for the 401.
  const credential = timestampedCredential(accountId, secret);
  const originalSecret = process.env.CAISSON_PROOF_PROXY_SECRET;
  const originalHost = process.env.CAISSON_PROOF_PROXY_INTERNAL_HOST;
  process.env.CAISSON_PROOF_PROXY_SECRET = secret;
  process.env.CAISSON_PROOF_PROXY_INTERNAL_HOST = "admin.railway.internal";

  try {
    const invalid = await proxy(
      new NextRequest(
        "https://admin.railway.internal/api/internal/audit/proof",
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${"0".repeat(64)}`,
            "x-caisson-account-id": accountId,
          },
        },
      ),
    );
    const publicOrigin = await proxy(
      new NextRequest("https://admin.caisson.sh/api/internal/audit/proof", {
        method: "POST",
        headers: {
          authorization: `Bearer ${credential}`,
          "x-caisson-account-id": accountId,
        },
      }),
    );

    expect(invalid.status).toBe(401);
    expect(publicOrigin.status).toBe(401);
  } finally {
    if (originalSecret === undefined)
      delete process.env.CAISSON_PROOF_PROXY_SECRET;
    else process.env.CAISSON_PROOF_PROXY_SECRET = originalSecret;
    if (originalHost === undefined)
      delete process.env.CAISSON_PROOF_PROXY_INTERNAL_HOST;
    else process.env.CAISSON_PROOF_PROXY_INTERNAL_HOST = originalHost;
  }
});

// --- WR-03 regression: matcher exclusions must be ANCHORED, not prefix-matched -------------------
// (the config.matcher regex itself is exercised structurally — Next resolves it internally — but
// the intent it encodes is worth pinning as a standalone assertion so a future edit can't silently
// widen `login`/`api/auth`/`healthz` back into a prefix match.)

test("proxy config.matcher anchors login/api-auth/healthz — a prefix collision is NOT excluded", () => {
  const pattern = proxyConfig.matcher[0];
  expect(pattern).toBeDefined();
  // Anchored explicitly: Next's own matcher compiler always applies the pattern from the start of
  // the pathname, but a raw `new RegExp(pattern).test(path)` without `^` would find a match
  // starting anywhere in the string — e.g. "/login/foo" would falsely "pass" by matching from its
  // trailing "/foo", masking exactly the prefix-collision bug this test exists to catch.
  const re = new RegExp(`^${pattern}`);
  // Real excluded paths: no match (the negative lookahead fires).
  expect(re.test("/login")).toBe(false);
  expect(re.test("/login/foo")).toBe(false);
  expect(re.test("/api/auth/callback/github")).toBe(false);
  expect(re.test("/healthz")).toBe(false);
  // Prefix-collision paths: MUST still be gated (match = gated, per the matcher's own semantics).
  expect(re.test("/loginboard")).toBe(true);
  expect(re.test("/api/authz")).toBe(true);
  expect(re.test("/healthzzz")).toBe(true);
});

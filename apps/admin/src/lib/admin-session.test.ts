// ADR-0283: `verifyAdminSession`, `requireAdmin`, and `proxy` unit tests, all sharing ONE mock —
// `admin-auth-mock.ts` owns the single `mock.module("./admin-auth-server.ts", ...)` registration
// for the whole suite (see its header for why). Testing `requireAdmin`/`proxy` here too, driven
// through the REAL (unmocked) `admin-session.ts`/`admin-route.ts`, which bottom out at that one
// mock, avoids ever mocking `admin-session.ts` itself — the module `proxy.ts` and `admin-route.ts`
// both import for real. `admin-auth-server.ts`'s OWN logic (env parsing, the databaseHooks gate,
// better-auth wiring) is exercised via admin-auth-config.test.ts + admin-auth-server.pglite.test.ts
// + the real better-auth build (`bunx next build`).
import { beforeEach, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { setAdminAuthFixture, VERIFIED_ADMIN } from "./admin-auth-mock.ts";

const { verifyAdminSession } = await import("./admin-session.ts");
const { requireAdmin } = await import("./admin-route.ts");
const { proxy, config: proxyConfig } = await import("../proxy.ts");

const REQ = new Request("https://admin.caisson.sh/business");

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
      getSession: async () => ({ user: { email: "op@gridwork.dev" } }),
      listUserAccounts: async () => [],
    },
  });
  expect(await verifyAdminSession(REQ)).toBeNull();
});

test("linked GitHub account NOT on the allowlist → denied (fail-closed)", async () => {
  setAdminAuthFixture({
    api: {
      getSession: async () => ({ user: { email: "op@gridwork.dev" } }),
      listUserAccounts: async () => [
        { providerId: "github", accountId: "999999" },
      ],
    },
  });
  expect(await verifyAdminSession(REQ)).toBeNull();
});

test("linked GitHub account ON the allowlist → verified actor (session email)", async () => {
  setAdminAuthFixture(VERIFIED_ADMIN);
  expect(await verifyAdminSession(REQ)).toEqual({ email: "op@gridwork.dev" });
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
  expect(await requireAdmin(withDifferentHeader)).toBe("op@gridwork.dev");
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
    "op@gridwork.dev",
  );
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

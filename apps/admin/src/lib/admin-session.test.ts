// ADR-0283: `verifyAdminSession` + `proxy` unit tests, sharing ONE mock. `admin-auth-server.ts` is
// mocked ONCE at module scope to a pair of indirection functions that read a shared mutable
// fixture — Bun's `mock.module` replaces a module in the process-wide registry for the whole test
// run (not scoped to one file), so a SECOND file mocking the same resolved module (or mocking
// `admin-session.ts` itself, which `proxy.ts` also imports) would silently clobber whichever mock
// registers last. Testing `proxy()` here too — driven through the REAL (unmocked) `admin-
// session.ts`, which bottoms out at this one `admin-auth-server.ts` mock — avoids that collision
// entirely instead of fighting it. `admin-auth-server.ts`'s OWN logic (env parsing, the
// databaseHooks gate, better-auth wiring) is exercised via admin-auth-config.test.ts + the real
// better-auth build (`bunx next build`).
import { beforeEach, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";

let mockAuth: unknown = null;
let mockAllowedGithubIds = new Set<string>();

mock.module("./admin-auth-server.ts", () => ({
  getAdminAuth: () => mockAuth,
  getAllowedGithubIds: () => mockAllowedGithubIds,
}));

const { verifyAdminSession } = await import("./admin-session.ts");
const { proxy } = await import("../proxy.ts");

const REQ = new Request("https://admin.caisson.sh/business");

beforeEach(() => {
  mockAuth = null;
  mockAllowedGithubIds = new Set(["123456"]);
});

test("unconfigured runtime (getAdminAuth null) → no verified actor", async () => {
  expect(await verifyAdminSession(REQ)).toBeNull();
});

test("no session → no verified actor", async () => {
  mockAuth = {
    api: {
      getSession: async () => null,
      listUserAccounts: async () => [],
    },
  };
  expect(await verifyAdminSession(REQ)).toBeNull();
});

test("session exists but no linked GitHub account → denied", async () => {
  mockAuth = {
    api: {
      getSession: async () => ({ user: { email: "op@gridwork.dev" } }),
      listUserAccounts: async () => [],
    },
  };
  expect(await verifyAdminSession(REQ)).toBeNull();
});

test("linked GitHub account NOT on the allowlist → denied (fail-closed)", async () => {
  mockAuth = {
    api: {
      getSession: async () => ({ user: { email: "op@gridwork.dev" } }),
      listUserAccounts: async () => [
        { providerId: "github", accountId: "999999" },
      ],
    },
  };
  expect(await verifyAdminSession(REQ)).toBeNull();
});

test("linked GitHub account ON the allowlist → verified actor (session email)", async () => {
  mockAuth = {
    api: {
      getSession: async () => ({ user: { email: "op@gridwork.dev" } }),
      listUserAccounts: async () => [
        { providerId: "github", accountId: "123456" },
      ],
    },
  };
  expect(await verifyAdminSession(REQ)).toEqual({ email: "op@gridwork.dev" });
});

test("blank session email falls back to the GitHub numeric id, never a blank actor", async () => {
  mockAuth = {
    api: {
      getSession: async () => ({ user: { email: "  " } }),
      listUserAccounts: async () => [
        { providerId: "github", accountId: "123456" },
      ],
    },
  };
  expect(await verifyAdminSession(REQ)).toEqual({ email: "123456" });
});

test("an empty CURRENT allowlist denies even a previously-valid id (live revocation)", async () => {
  mockAuth = {
    api: {
      getSession: async () => ({ user: { email: "op@gridwork.dev" } }),
      listUserAccounts: async () => [
        { providerId: "github", accountId: "123456" },
      ],
    },
  };
  mockAllowedGithubIds = new Set();
  expect(await verifyAdminSession(REQ)).toBeNull();
});

test("a lookup error (bad/forged session, unreachable DB) fails closed, never throws", async () => {
  mockAuth = {
    api: {
      getSession: async () => {
        throw new Error("boom");
      },
      listUserAccounts: async () => [],
    },
  };
  await expect(verifyAdminSession(REQ)).resolves.toBeNull();
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
  mockAuth = {
    api: {
      getSession: async () => ({ user: { email: "op@gridwork.dev" } }),
      listUserAccounts: async () => [
        { providerId: "github", accountId: "123456" },
      ],
    },
  };
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

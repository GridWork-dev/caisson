// ADR-0366 SHIP-audit fix (P2): `/list-sessions`, `/revoke-session`, `/revoke-other-sessions` are
// denied at the `/api/auth/[...all]` catch-all BEFORE they ever reach better-auth's handler —
// under the session-token wrap they leak the stored HMAC lookup key or silently revoke nothing
// while still answering `{status:true}` (see the DENIED_PATHS comment in the route file).
// `/revoke-sessions` (revoke ALL, keyed by the verified userId) is the positive control: it is NOT
// denied and still works. Lives under `lib/` (not colocated in `app/`) so it's covered by this
// package's `test` script (`bun test ./lib ./emails ./components` — `./app` is not globbed).
//
// Real sign-in flow against an in-memory `bun:sqlite` double (no live Postgres), same pattern as
// `auth-server.test.ts` — `getAuth()` is mocked to resolve to that REAL wrapped instance so this
// test drives the ACTUAL route handlers end to end, not a stand-in.
import { expect, mock, test } from "bun:test";
import { Database } from "bun:sqlite";
import { getMigrations } from "better-auth/db/migration";
import { createCaptureEmailer } from "@caisson/email";
import type { Pool } from "pg";
import * as realAuthServer from "./auth-server.ts";
import { createAuth } from "./auth-server.ts";

const HMAC_KEY = "test-hmac-key-value-at-least-32-characters-long";

async function buildSignedInRouteAuth() {
  const emailer = createCaptureEmailer();
  const rawDb = new Database(":memory:") as unknown as Pool;
  const auth = await createAuth({
    database: rawDb,
    secret: "test-secret-value-at-least-32-characters-long",
    emailer,
    hmacKey: HMAC_KEY,
    baseURL: "http://localhost:3030",
  });
  const { runMigrations } = await getMigrations({
    ...auth.options,
    database: rawDb,
  });
  await runMigrations();

  await auth.api.signInMagicLink({
    body: { email: "buyer@example.com" },
    headers: new Headers(),
  });
  const url = String((emailer.sent[0]!.data as { url?: unknown }).url);
  const verifyRes = await auth.handler(new Request(url, { method: "GET" }));
  const cookieHeader = verifyRes.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

  mock.module("./auth-server.ts", () => ({
    ...realAuthServer,
    getAuth: async () => auth,
  }));
  // The route imports via the `@/lib/auth-server` alias — Bun resolves both specifiers to the
  // same file, but `mock.module` keys off the specifier string used at the CALL SITE, so the
  // alias form needs its own registration too.
  mock.module("@/lib/auth-server", () => ({
    ...realAuthServer,
    getAuth: async () => auth,
  }));

  return { rawDb: rawDb as unknown as Database, cookieHeader };
}

function sessionRowCount(rawDb: Database): number {
  return (
    rawDb.query("SELECT COUNT(*) AS n FROM session").get() as { n: number }
  ).n;
}

test("denied paths 404 before ever reaching better-auth — the session table is untouched", async () => {
  const { rawDb, cookieHeader } = await buildSignedInRouteAuth();
  const { GET, POST } = await import("../app/api/auth/[...all]/route.ts");
  expect(sessionRowCount(rawDb)).toBe(1);

  const listRes = await GET(
    new Request("http://localhost:3030/api/auth/list-sessions", {
      headers: { cookie: cookieHeader },
    }),
  );
  expect(listRes.status).toBe(404);
  expect(await listRes.json()).toEqual({ error: "not_found" });

  const revokeRes = await POST(
    new Request("http://localhost:3030/api/auth/revoke-session", {
      method: "POST",
      headers: { cookie: cookieHeader, "content-type": "application/json" },
      body: JSON.stringify({ token: "whatever" }),
    }),
  );
  expect(revokeRes.status).toBe(404);

  const revokeOtherRes = await POST(
    new Request("http://localhost:3030/api/auth/revoke-other-sessions", {
      method: "POST",
      headers: { cookie: cookieHeader },
    }),
  );
  expect(revokeOtherRes.status).toBe(404);

  // None of the three denied calls touched the adapter at all.
  expect(sessionRowCount(rawDb)).toBe(1);
});

test("/revoke-sessions (plural, all-by-userId) is NOT denied and still revokes for real", async () => {
  const { rawDb, cookieHeader } = await buildSignedInRouteAuth();
  const { POST } = await import("../app/api/auth/[...all]/route.ts");
  expect(sessionRowCount(rawDb)).toBe(1);

  const res = await POST(
    new Request("http://localhost:3030/api/auth/revoke-sessions", {
      method: "POST",
      headers: { cookie: cookieHeader },
    }),
  );
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: true });
  expect(sessionRowCount(rawDb)).toBe(0);
});

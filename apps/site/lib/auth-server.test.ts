// Regression coverage for CAISSON-81 (ADR-0315): the server-minted, non-HttpOnly session-hint
// cookie mint/clear wiring inside `createAuth()`'s `databaseHooks.session`. Exercised end-to-end
// against a REAL magic-link sign-in + sign-out — same pattern as `auth-flow.test.ts` (in-memory
// bun:sqlite via better-auth's own Kysely adapter, no live Postgres, the capture email transport).
//
// `createAuth()`'s `database` param is typed to `pg.Pool` for production call-site safety (the
// deploy entrypoint always passes a real Pool); better-auth itself duck-types the adapter at
// runtime — a `bun:sqlite` `Database` works identically (proven by `auth-flow.test.ts`'s raw
// `betterAuth()` call). The cast below is TEST-ONLY, so this test can drive the REAL `createAuth()`
// wiring (databaseHooks included) instead of hand-duplicating it.
import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { getMigrations } from "better-auth/db/migration";
import { createCaptureEmailer } from "@caisson/email";
import type { Pool } from "pg";
import { createAuth, SESSION_HINT_COOKIE_NAME } from "./auth-server.ts";

async function buildSignedInAuth() {
  const emailer = createCaptureEmailer();
  const auth = createAuth({
    database: new Database(":memory:") as unknown as Pool,
    secret: "test-secret-value-at-least-32-characters-long",
    emailer,
    baseURL: "http://localhost:3030",
  });
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();

  await auth.api.signInMagicLink({
    body: { email: "buyer@example.com" },
    headers: new Headers(),
  });
  const url = String((emailer.sent[0]?.data as { url?: unknown }).url);
  const verifyRes = await auth.handler(new Request(url, { method: "GET" }));
  return { auth, verifyRes };
}

test("sign-in mints the hint cookie: Secure + SameSite=Strict + not-HttpOnly + expiry matching the session cookie", async () => {
  const { verifyRes } = await buildSignedInAuth();
  const setCookies = verifyRes.headers.getSetCookie();

  const sessionCookie = setCookies.find((c) => c.includes("session_token"));
  const hintCookie = setCookies.find((c) =>
    c.startsWith(`${SESSION_HINT_COOKIE_NAME}=`),
  );
  expect(sessionCookie).toBeDefined();
  expect(hintCookie).toBeDefined();

  const hint = hintCookie ?? "";
  expect(hint).toContain(`${SESSION_HINT_COOKIE_NAME}=1`);
  expect(hint).toContain("Secure");
  expect(hint).toMatch(/SameSite=Strict/i);
  expect(hint).not.toContain("HttpOnly");

  // Minted from the SAME `session.expiresAt` the real session cookie carries — never a
  // separately-tracked lifetime. The two cookies serialize their lifetime differently
  // (better-auth's session cookie as a relative `Max-Age`, the hint as an absolute `Expires`,
  // since `ctx.setCookie` was called with `expires: newSession.session.expiresAt` directly) — so
  // compare the resolved point in time, not the raw attribute string, within a small tolerance for
  // the few milliseconds elapsed between the two Set-Cookie headers being built.
  const sessionMaxAgeSeconds = Number(
    /Max-Age=(\d+)/i.exec(sessionCookie ?? "")?.[1],
  );
  const hintExpires = /Expires=([^;]+)/i.exec(hint)?.[1];
  expect(Number.isFinite(sessionMaxAgeSeconds)).toBe(true);
  expect(hintExpires).toBeDefined();
  const hintExpiresMs = new Date(String(hintExpires)).getTime();
  const sessionExpiresApproxMs = Date.now() + sessionMaxAgeSeconds * 1000;
  expect(Math.abs(hintExpiresMs - sessionExpiresApproxMs)).toBeLessThan(5000);
});

test("sign-out clears the hint cookie", async () => {
  const { auth, verifyRes } = await buildSignedInAuth();
  const cookieHeader = verifyRes.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

  const signOutRes = await auth.api.signOut({
    headers: new Headers({ cookie: cookieHeader }),
    asResponse: true,
  });
  const cleared = signOutRes.headers
    .getSetCookie()
    .find((c) => c.startsWith(`${SESSION_HINT_COOKIE_NAME}=`));
  expect(cleared).toBeDefined();
  // Cleared via Max-Age=0 — never re-sent as a live "1".
  expect(cleared).not.toContain(`${SESSION_HINT_COOKIE_NAME}=1`);
});

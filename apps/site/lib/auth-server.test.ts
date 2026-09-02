// Regression coverage for ADR-0418: the server-minted, HttpOnly session-hint cookie mint/clear
// wiring inside `createAuth()`'s `hooks.after` (`sessionHintCookieHook`). Exercised end-to-end
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
import { deriveTokenLookupKey } from "@caisson/auth";
import { createCaptureEmailer } from "@caisson/email";
import type { Pool } from "pg";
import { createAuth, SESSION_HINT_COOKIE_NAME } from "./auth-server.ts";

// Fixed across tests so the ADR-0366 round-trip assertions below can recompute the expected
// lookup key independently of `createAuth()`'s internals.
const TEST_HMAC_KEY = "test-hmac-key-value-at-least-32-characters-long";

async function buildSignedInAuth() {
  const emailer = createCaptureEmailer();
  const rawDb = new Database(":memory:") as unknown as Pool;
  const auth = await createAuth({
    database: rawDb,
    secret: "test-secret-value-at-least-32-characters-long",
    emailer,
    hmacKey: TEST_HMAC_KEY,
    baseURL: "http://localhost:3030",
  });
  // `auth.options.database` is the ADR-0366 wrapped adapter factory — `getMigrations` needs the
  // RAW in-memory db back to dialect-detect (see the comment on `createAuth` in auth-server.ts).
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
  return { auth, verifyRes, rawDb: rawDb as unknown as Database };
}

/**
 * The `caisson.session_token` Set-Cookie value, in both forms: `signed` is exactly what a real
 * browser would hold and send back (better-auth signs this cookie —
 * `ctx.setSignedCookie`/`<token>.<signature>` — and `getSession`'s read path rejects an unsigned
 * value); `bareToken` strips the signature, giving the actual token the adapter hashes and stores.
 * `generateId(32)`'s alphabet (a-z, A-Z, 0-9) never contains a literal `.`, so splitting on the
 * first one is exact.
 */
function sessionTokenFromCookies(setCookies: string[]): {
  signed: string;
  bareToken: string;
} {
  const cookie = setCookies.find((c) => c.includes("session_token"));
  const match = /session_token=([^;]+)/.exec(cookie ?? "");
  const signed = decodeURIComponent(String(match?.[1]));
  return { signed, bareToken: signed.split(".")[0] ?? signed };
}

test("sign-in mints the hint cookie: Secure + SameSite=Strict + HttpOnly + expiry matching the session cookie", async () => {
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
  expect(hint).toContain("HttpOnly");

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

// ADR-0366: the session-token hash-at-rest wrap. These exercise the REAL sign-in flow above
// through `wrapSessionAdapter` (no mocking of the adapter) — the practical conformance guard the
// SPEC calls for: a better-auth upgrade that moves the session query shape breaks these first.
test("ADR-0366: the raw cookie token is never stored — the DB row holds its HMAC lookup key instead", async () => {
  const { verifyRes, rawDb } = await buildSignedInAuth();
  const { bareToken } = sessionTokenFromCookies(
    verifyRes.headers.getSetCookie(),
  );
  expect(bareToken.length).toBeGreaterThan(0);

  const rows = rawDb.query("SELECT token FROM session").all() as {
    token: string;
  }[];
  expect(rows).toHaveLength(1);
  const storedToken = rows[0]?.token ?? "";

  // The stored value is never the raw cookie token...
  expect(storedToken).not.toBe(bareToken);
  // ...it is exactly that token's HMAC-SHA-256 lookup key (the round trip).
  expect(storedToken).toBe(deriveTokenLookupKey(bareToken, TEST_HMAC_KEY));
  expect(storedToken).toMatch(/^[0-9a-f]{64}$/);
});

test("ADR-0366: a signed-in session still resolves end to end through the wrapped adapter", async () => {
  const { auth, verifyRes } = await buildSignedInAuth();
  // The FULL signed cookie value — exactly what a real browser sends back; better-auth verifies
  // the signature and extracts the bare token internally before it ever reaches the adapter wrap.
  const { signed } = sessionTokenFromCookies(verifyRes.headers.getSetCookie());

  const session = await auth.api.getSession({
    headers: new Headers({
      cookie: `caisson.session_token=${signed}`,
    }),
  });
  expect(session?.user.email).toBe("buyer@example.com");
});

test("ADR-0366: createAuth() fails closed (throws) when the HMAC key is empty", async () => {
  await expect(
    createAuth({
      database: new Database(":memory:") as unknown as Pool,
      secret: "test-secret-value-at-least-32-characters-long",
      emailer: createCaptureEmailer(),
      hmacKey: "",
    }),
  ).rejects.toThrow(/SESSION_TOKEN_HMAC_KEY/);
});

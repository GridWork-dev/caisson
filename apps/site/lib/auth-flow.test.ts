// Exercises the REAL magic-link → session flow end-to-end against an in-memory SQLite database
// (no live Postgres needed) with the `@caisson/email` capture transport standing in for Resend.
// This is the load-bearing behavioural test: a valid magic link, once verified, establishes a
// better-auth session that resolves back to the signed-in user.
import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { magicLink } from "better-auth/plugins";
import { createCaptureEmailer } from "@caisson/email";

test("a valid magic link establishes a session (capture transport)", async () => {
  const capture = createCaptureEmailer();
  const auth = betterAuth({
    database: new Database(":memory:"),
    secret: "test-secret-value-at-least-32-characters-long",
    baseURL: "http://localhost:3030",
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }): Promise<void> => {
          await capture.send({ to: email, template: "magic", data: { url } });
        },
      }),
    ],
  });

  // Create better-auth's tables in the in-memory DB (built-in Kysely adapter).
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();

  // 1. Request a magic link → the transport captures the generated URL (carrying the token).
  await auth.api.signInMagicLink({
    body: { email: "buyer@example.com" },
    headers: new Headers(),
  });
  expect(capture.sent).toHaveLength(1);
  const url = String((capture.sent[0]?.data as { url?: unknown }).url);
  expect(new URL(url).searchParams.get("token")).not.toBeNull();

  // 2. Click the link (the exact URL better-auth generated) → verifies + issues a session cookie.
  const verifyRes = await auth.handler(new Request(url, { method: "GET" }));
  expect(verifyRes.status).toBe(302); // redirected to the callbackURL, signed in
  const setCookies = verifyRes.headers.getSetCookie();
  expect(setCookies.some((c) => c.includes("session_token"))).toBe(true);

  // 3. The session resolves from that cookie back to the signed-in buyer.
  const cookieHeader = setCookies.map((c) => c.split(";")[0]).join("; ");
  const session = await auth.api.getSession({
    headers: new Headers({ cookie: cookieHeader }),
  });
  expect(session?.user.email).toBe("buyer@example.com");
});

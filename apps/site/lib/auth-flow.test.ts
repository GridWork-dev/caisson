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
          await capture.send({
            to: email,
            template: "magic-link",
            data: { url },
          });
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
  const url = String((capture.sent[0]!.data as { url?: unknown }).url);
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

// Exercises the password account lifecycle end-to-end: sign-up fires a verification email
// (never a session — requireEmailVerification is on), clicking it verifies + signs in, and a
// subsequent forgot/reset-password round trip lands on the NEW password (capture transport).
test("password sign-up requires verification; forgot/reset-password then resolves with the new password", async () => {
  const capture = createCaptureEmailer();
  const auth = betterAuth({
    database: new Database(":memory:"),
    secret: "test-secret-value-at-least-32-characters-long",
    baseURL: "http://localhost:3030",
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }): Promise<void> => {
        await capture.send({
          to: user.email,
          template: "password-reset",
          data: { url },
        });
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }): Promise<void> => {
        await capture.send({
          to: user.email,
          template: "verify-email",
          data: { url },
        });
      },
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
    },
  });

  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();

  // 1. Sign up with a password — no session yet, a verification email fires instead.
  await auth.api.signUpEmail({
    body: {
      email: "buyer@example.com",
      password: "correct-horse-battery",
      name: "Buyer",
    },
    headers: new Headers(),
  });
  expect(capture.sent).toHaveLength(1);
  expect(capture.sent[0]?.template).toBe("verify-email");
  const verifyUrl = String((capture.sent[0]!.data as { url?: unknown }).url);

  // An unverified account cannot sign in yet.
  await expect(
    auth.api.signInEmail({
      body: { email: "buyer@example.com", password: "correct-horse-battery" },
      headers: new Headers(),
    }),
  ).rejects.toThrow();

  // 2. Click the verification link — verifies the email and signs the buyer in.
  const verifyRes = await auth.handler(
    new Request(verifyUrl, { method: "GET" }),
  );
  expect(verifyRes.status).toBeLessThan(400);

  // 3. Forgot password — a reset email fires with a one-time token url. `requestPasswordReset` is
  // both the server `auth.api` name and the client SDK method (`authClient.requestPasswordReset`).
  await auth.api.requestPasswordReset({
    body: {
      email: "buyer@example.com",
      redirectTo: "http://localhost:3030/reset-password",
    },
    headers: new Headers(),
  });
  expect(capture.sent).toHaveLength(2);
  expect(capture.sent[1]?.template).toBe("password-reset");
  // The mailed url is better-auth's OWN verify endpoint (`/api/auth/reset-password/:token`),
  // which a real browser click 302-redirects onward to `callbackURL?token=...` (the app's actual
  // `/reset-password` page — same shape as the query-param token the magic-link flow carries).
  // The token is the path's last segment here.
  const resetUrl = String((capture.sent[1]!.data as { url?: unknown }).url);
  const token = new URL(resetUrl).pathname.split("/").pop();
  expect(token).toBeTruthy();

  // 4. Reset to a new password, then sign in with it.
  await auth.api.resetPassword({
    body: { newPassword: "even-stronger-password", token: String(token) },
    headers: new Headers(),
  });
  const signInRes = await auth.api.signInEmail({
    body: { email: "buyer@example.com", password: "even-stronger-password" },
    headers: new Headers(),
    asResponse: true,
  });
  expect(signInRes.status).toBeLessThan(400);
});

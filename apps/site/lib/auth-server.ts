// The better-auth sign-in runtime (ADR-0015: better-auth is the self-hosted SessionProvider that
// owns its user/session/account/verification tables). This is the SERVER instance the Next route
// handler mounts and the dashboard resolves sessions from. It is built LAZILY and is boot/build
// safe: with no `DATABASE_URL` + `BETTER_AUTH_SECRET` it returns `null` (sign-in simply
// unavailable — dev/CI/build with no Postgres), never throwing at import so `next build` and
// `bunx tsc` stay green without a live database.
//
// Auth methods:
//  - Magic link (PRIMARY, always on): the link email is sent through `@caisson/email`'s `Emailer`
//    port — the Resend driver in prod (`RESEND_API_KEY`), the in-memory capture driver otherwise.
//  - Email + password: a signed-up password account requires email verification before it can
//    sign in (`requireEmailVerification`) — unlike the magic link, a password alone never proves
//    inbox ownership, so the trust boundary needs the extra round trip. Both the verification and
//    password-reset emails route through the SAME injected `Emailer`.
//  - GitHub + Google OAuth: offered ONLY when their credentials are present (`resolveSocialProviders`).
//
// The session cookie is hardened per the security floor: `SameSite=Strict`, `HttpOnly`, and
// `Secure` (better-auth sets Secure automatically in production). OAuth's short-lived state
// cookies keep better-auth's default `SameSite=Lax` — they MUST survive the provider's top-level
// cross-site redirect back to our callback, which a Strict cookie would drop; only the durable
// SESSION cookie is pinned to Strict.
import { Pool } from "pg";
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import {
  type CaptureEmailer,
  type Emailer,
  createCaptureEmailer,
  createResendEmailer,
} from "@caisson/email";
import { resolveSocialProviders } from "./auth-config.ts";

/** The prefixed session cookie name the security floor pins (`${cookiePrefix}.session_token`). */
export const SESSION_COOKIE_NAME = "caisson.session_token";

/**
 * Resolve the magic-link transport: the Resend driver when `RESEND_API_KEY` is configured, an
 * in-memory capture driver otherwise (so a dev/CI instance never hits the network and tests can
 * assert the sent link). The `from` address is env-driven (`RESEND_FROM`) with a safe default —
 * never a hardcoded secret.
 */
function resolveEmailer(): Emailer | CaptureEmailer {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey !== undefined && apiKey.length > 0) {
    return createResendEmailer({
      apiKey,
      from: process.env.RESEND_FROM?.trim() ?? "Caisson <no-reply@caisson.sh>",
    });
  }
  return createCaptureEmailer();
}

/**
 * Build a better-auth instance over a Postgres pool. Exported so tests can construct an instance
 * against an in-memory database with a capture transport, exercising the real magic-link →
 * session flow without a live Postgres. `emailer` is injected; `baseURL` is optional (better-auth
 * infers it from the request when absent).
 */
export function createAuth(params: {
  database: Pool;
  secret: string;
  emailer: Emailer;
  baseURL?: string | undefined;
}) {
  const { database, secret, emailer, baseURL } = params;
  return betterAuth({
    database,
    secret,
    basePath: "/api/auth",
    ...(baseURL !== undefined && baseURL.length > 0 ? { baseURL } : {}),
    plugins: [
      magicLink({
        // PRIMARY sign-in. The link is emailed through the injected transport; the URL better-auth
        // generates carries the one-time token and the post-verify redirect (callbackURL).
        sendMagicLink: async ({ email, url }): Promise<void> => {
          await emailer.send({
            to: email,
            template: "magic-link",
            data: { url },
          });
        },
      }),
    ],
    emailAndPassword: {
      enabled: true,
      // A password alone doesn't prove inbox ownership the way a clicked magic link does —
      // require verification before a password account can sign in.
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }): Promise<void> => {
        await emailer.send({
          to: user.email,
          template: "password-reset",
          data: { url },
        });
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }): Promise<void> => {
        await emailer.send({
          to: user.email,
          template: "verify-email",
          data: { url },
        });
      },
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
    },
    socialProviders: resolveSocialProviders(process.env),
    advanced: {
      cookiePrefix: "caisson",
      cookies: {
        session_token: {
          // Security floor: the durable session cookie is Strict + HttpOnly. `Secure` is added by
          // better-auth in production (NODE_ENV=production).
          attributes: { sameSite: "strict", httpOnly: true, path: "/" },
        },
      },
    },
  });
}

type AuthInstance = ReturnType<typeof createAuth>;

// `undefined` = not yet resolved this process; `null` = resolved-but-unavailable (no DB/secret).
let cached: AuthInstance | null | undefined;

/**
 * The process-wide better-auth instance, or `null` when the runtime is not configured for
 * sign-in (`DATABASE_URL` or `BETTER_AUTH_SECRET` absent). Callers MUST treat `null` as "sign-in
 * unavailable" — the route handler answers 503, `getSession` returns no session. Resolved once and
 * cached (one Postgres pool per process).
 */
export function getAuth(): AuthInstance | null {
  if (cached !== undefined) return cached;
  const url = process.env.DATABASE_URL?.trim();
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (
    url === undefined ||
    url.length === 0 ||
    secret === undefined ||
    secret.length === 0
  ) {
    cached = null;
    return cached;
  }
  const pool = new Pool({ connectionString: url });
  pool.on("error", (err) => {
    process.stderr.write(`[apps/site] idle pg client error: ${err.message}\n`);
  });
  cached = createAuth({
    database: pool,
    secret,
    emailer: resolveEmailer(),
    baseURL: process.env.BETTER_AUTH_URL?.trim(),
  });
  return cached;
}

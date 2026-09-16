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
import { createPgPool } from "@caisson/tenancy-rls";
import type { Pool } from "pg";
import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { magicLink } from "better-auth/plugins";
import type { BetterAuthOptions } from "better-auth/types";
// ADR-0366: better-auth exposes no public `database`-construction subpath (its own internal
// `getAdapter` reaches into this same package), so the session-token wrap depends on it
// directly, pinned to better-auth's OWN exact version below — the two ship in lockstep upstream.
import {
  createKyselyAdapter,
  kyselyAdapter,
} from "@better-auth/kysely-adapter";
import {
  type CaptureEmailer,
  type Emailer,
  createCaptureEmailer,
  createResendEmailer,
} from "@caisson/email";
import { resolveSocialProviders } from "./auth-config.ts";
import { SESSION_HINT_COOKIE_NAME } from "./session-hint-cookie.ts";
import { wrapSessionAdapter } from "./session-adapter.ts";

export { SESSION_HINT_COOKIE_NAME } from "./session-hint-cookie.ts";

/** The prefixed session cookie name the security floor pins (`${cookiePrefix}.session_token`). */
export const SESSION_COOKIE_NAME = "caisson.session_token";

/** Legacy HttpOnly hint mint/clear compatibility (ADR-0418). ADR-0424 removes the ownership
 * short-circuit: this cookie never establishes session absence or controls checkout. */
const sessionHintCookieHook = createAuthMiddleware(async (ctx) => {
  if (ctx.context.newSession) {
    // Unconditionally Secure (unlike the real session cookie, which only forces it in production —
    // see `advanced.cookies.session_token` below): this cookie carries no secret, so there's no
    // production/dev split to preserve, and modern browsers exempt `localhost` from the
    // https-only restriction on Secure cookies, so local dev keeps working.
    ctx.setCookie(SESSION_HINT_COOKIE_NAME, "1", {
      secure: true,
      sameSite: "strict",
      httpOnly: true,
      path: "/",
      expires: ctx.context.newSession.session.expiresAt,
    });
  } else if (ctx.path === "/sign-out") {
    // Fail-open in the other direction: a stray hint cookie left behind by a client that ignored
    // this Set-Cookie just costs one wasted `/api/cart/owned` fetch (the provider's own fail-open
    // contract), never a false "owned" marking.
    ctx.setCookie(SESSION_HINT_COOKIE_NAME, "", {
      secure: true,
      sameSite: "strict",
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
  }
});

/**
 * Resolve the magic-link transport: the Resend driver when `RESEND_API_KEY` is configured, an
 * in-memory capture driver otherwise (so a dev/CI instance never hits the network and tests can
 * assert the sent link). The `from` address is env-driven (`RESEND_FROM`) with a safe default —
 * never a hardcoded secret. Replies to the no-reply sender land in the support inbox.
 */
function resolveEmailer(): Emailer | CaptureEmailer {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey !== undefined && apiKey.length > 0) {
    return createResendEmailer({
      apiKey,
      from: process.env.RESEND_FROM?.trim() ?? "Caisson <no-reply@caisson.sh>",
      replyTo: "support@caisson.sh",
    });
  }
  return createCaptureEmailer();
}

/**
 * Build a better-auth instance over a Postgres pool. Exported so tests can construct an instance
 * against an in-memory database with a capture transport, exercising the real magic-link →
 * session flow without a live Postgres. `emailer` is injected; `baseURL` is optional (better-auth
 * infers it from the request when absent).
 *
 * `hmacKey` (ADR-0366) is REQUIRED and checked here too (construction-time fail-closed), not just
 * by `getAuth()`'s env read below — any other caller that forgets it gets the same loud throw
 * instead of a silent raw-token fallback. The session-token adapter wrap (`session-adapter.ts`)
 * is built from the SAME `database` here via `createKyselyAdapter`/`kyselyAdapter` (the exact
 * dialect-detection better-auth itself uses internally), so it works against both a real `pg.Pool`
 * (production) and the in-memory `bun:sqlite` double used by this app's own tests — a hand-rolled
 * `PostgresDialect` would only work against the former and break the latter.
 *
 * NOTE for callers that also run `getMigrations(auth.options)` (schema DDL, e.g.
 * `deploy-migrate.ts`): `auth.options.database` below is the WRAPPED adapter FACTORY, which
 * `getMigrations`'s own dialect detection cannot introspect (it only recognizes a raw
 * Pool/Dialect/Kysely shape). Substitute the raw `database` value back in for that call:
 * `getMigrations({ ...auth.options, database })`. Schema DDL is unaffected by the session-token
 * wrap either way — this is purely about `createKyselyAdapter`'s dialect-detection reach.
 */
export async function createAuth(params: {
  database: Pool;
  secret: string;
  emailer: Emailer;
  hmacKey: string;
  baseURL?: string | undefined;
}) {
  const { database, secret, emailer, baseURL, hmacKey } = params;
  if (hmacKey.trim().length === 0) {
    throw new Error(
      "SESSION_TOKEN_HMAC_KEY is required to construct the auth runtime (ADR-0366) — refusing to start rather than fall back to storing raw session tokens.",
    );
  }
  // Safe partial cast: `createKyselyAdapter` reads only `config.database` (verified against
  // `@better-auth/kysely-adapter`'s source) — the rest of `BetterAuthOptions` is irrelevant to
  // dialect detection.
  const { kysely, databaseType, transaction } = await createKyselyAdapter({
    database,
  } as BetterAuthOptions);
  if (!kysely) {
    throw new Error(
      "session-adapter: failed to initialize the database adapter for the ADR-0366 session-token wrap.",
    );
  }
  const baseAdapterFactory = kyselyAdapter(kysely, {
    type: databaseType ?? "postgres",
    transaction,
  });
  return betterAuth({
    database: (options: BetterAuthOptions) =>
      wrapSessionAdapter(baseAdapterFactory(options), hmacKey),
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
    // ADR-0418: mint/refresh the HttpOnly hint cookie alongside every real session
    // create/refresh, clear it on sign-out. See `sessionHintCookieHook` above.
    hooks: { after: sessionHintCookieHook },
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

type AuthInstance = Awaited<ReturnType<typeof createAuth>>;

// `undefined` = not yet resolved this process; a resolved promise carries `null` for
// resolved-but-unavailable (no DB/secret). `createAuth` is now async (ADR-0366: it awaits
// `createKyselyAdapter` to build the session-token-wrapped adapter), so the cache holds the
// in-flight/settled PROMISE itself, not its result — every caller `await`s the same one.
let cached: Promise<AuthInstance | null> | undefined;

/**
 * The process-wide better-auth instance, or `null` when the runtime is not configured for
 * sign-in (`DATABASE_URL` or `BETTER_AUTH_SECRET` absent). Callers MUST treat `null` as "sign-in
 * unavailable" — the route handler answers 503, `getSession` returns no session. Resolved once and
 * cached (one Postgres pool per process).
 */
export function getAuth(): Promise<AuthInstance | null> {
  if (cached !== undefined) return cached;
  const url = process.env.DATABASE_URL?.trim();
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (
    url === undefined ||
    url.length === 0 ||
    secret === undefined ||
    secret.length === 0
  ) {
    cached = Promise.resolve(null);
    return cached;
  }
  const hmacKey = process.env.SESSION_TOKEN_HMAC_KEY?.trim();
  if (hmacKey === undefined || hmacKey.length === 0) {
    // Fail-closed (ADR-0366): DATABASE_URL + BETTER_AUTH_SECRET ARE configured (this would
    // otherwise be a live auth runtime), so a missing HMAC key is an operator misconfiguration,
    // never a silent "sign-in unavailable" degrade or a raw-token fallback. Throwing here surfaces
    // loudly (a crashed boot / a failed health check) instead of masking a forgotten env var as an
    // ordinary DB-down outage.
    throw new Error(
      "SESSION_TOKEN_HMAC_KEY is required once DATABASE_URL/BETTER_AUTH_SECRET are configured (ADR-0366) — refusing to start auth with raw session-token storage.",
    );
  }
  const pool = createPgPool(url);
  cached = createAuth({
    database: pool,
    secret,
    emailer: resolveEmailer(),
    hmacKey,
    baseURL: process.env.BETTER_AUTH_URL?.trim(),
  });
  return cached;
}

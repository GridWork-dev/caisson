// The admin sign-in runtime (ADR-0283: in-app GitHub OAuth replaces the permanent CF-Access gate
// of ADR-0138/0140). better-auth is the operator SessionProvider, mirroring apps/site/lib/auth-
// server.ts's lazy, boot-safe singleton — GitHub is the ONLY sign-in method (no magic link, no
// email+password: this is a single-operator control-plane, not a buyer product). With no
// ADMIN_AUTH_DATABASE_URL / ADMIN_BETTER_AUTH_SECRET / GitHub OAuth credential pair configured,
// `getAdminAuth()` returns `null` rather than throwing, so `next build` / `bunx tsc` stay green
// with no live Postgres or OAuth app provisioned.
//
// admin gets its OWN better-auth tables, in its OWN database (ADMIN_AUTH_DATABASE_URL) — NEVER
// the buyer-auth tables that live in the site's DB, and NEVER `CAISSON_ADMIN_DB_URL` (admin-
// db.ts's read-only, cross-tenant `SET ROLE admin` connection business views read through) —
// that role's RLS-read contract has nothing to do with owning a normal user/session/account table
// set that needs ordinary INSERT/UPDATE privileges.
//
// The allowlist gate (ADR-0283): `databaseHooks.account.create.before` rejects linking ANY GitHub
// account whose NUMERIC id (`account.accountId` — the raw provider id GitHub issues, never the
// username/login) isn't in `getAllowedGithubIds()`. This fires at account-CREATION time; better-
// auth may still leave an orphan `user` row from the same aborted sign-up (no `account` row links
// it to any provider), but that user can never SIGN IN — no linked GitHub account means every
// session check denies. The complementary "session ... destroyed" half (re-checking the CURRENT
// allowlist on every already-authenticated request, so narrowing the allowlist after the fact
// still takes effect) lives in `admin-session.ts`'s `verifyAdminSession`.
import { Pool } from "pg";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import {
  isAllowedGithubId,
  parseAllowedGithubIds,
} from "./admin-auth-config.ts";

/**
 * Build a better-auth instance over a Postgres pool. Exported so tests can construct an instance
 * against an isolated database without going through env / process-wide caching.
 */
export function createAdminAuth(params: {
  database: Pool;
  secret: string;
  githubClientId: string;
  githubClientSecret: string;
  allowedGithubIds: Set<string>;
  baseURL?: string | undefined;
}) {
  const {
    database,
    secret,
    githubClientId,
    githubClientSecret,
    allowedGithubIds,
    baseURL,
  } = params;
  return betterAuth({
    database,
    secret,
    basePath: "/api/auth",
    ...(baseURL !== undefined && baseURL.length > 0 ? { baseURL } : {}),
    socialProviders: {
      github: { clientId: githubClientId, clientSecret: githubClientSecret },
    },
    databaseHooks: {
      account: {
        create: {
          before: async (account) => {
            if (!isAllowedGithubId(account.accountId, allowedGithubIds)) {
              // Fail-closed: no user/account row is ever created for an id off the allowlist —
              // "session never created" (ADR-0283). Since GitHub is the only configured
              // provider, `account.accountId` here is always GitHub's raw numeric user id.
              throw new APIError("FORBIDDEN", {
                message:
                  "This GitHub account is not authorized for admin access.",
              });
            }
          },
        },
      },
    },
    advanced: {
      // Distinct prefix from the site's `caisson.*` buyer cookies (own database, own domain,
      // own concern — never mixed up even though both are "Caisson" cookies in a browser jar).
      cookiePrefix: "caisson-admin",
      cookies: {
        session_token: {
          // Security floor: the durable session cookie is Strict + HttpOnly. `Secure` is added
          // by better-auth in production (NODE_ENV=production).
          attributes: { sameSite: "strict", httpOnly: true, path: "/" },
        },
      },
    },
  });
}

export type AdminAuthInstance = ReturnType<typeof createAdminAuth>;

// `undefined` = not yet resolved this process; `null` = resolved-but-unavailable.
let cachedAuth: AdminAuthInstance | null | undefined;
let cachedAllowedGithubIds: Set<string> | undefined;

/**
 * The live GitHub-numeric-id allowlist, parsed once per process from
 * `ADMIN_GITHUB_ALLOWED_USER_IDS`. Changing it requires a redeploy (Railway env vars are not
 * hot-reloaded) — the same operational shape as every other env-gated surface in this app.
 */
export function getAllowedGithubIds(): Set<string> {
  if (cachedAllowedGithubIds === undefined) {
    cachedAllowedGithubIds = parseAllowedGithubIds(
      process.env.ADMIN_GITHUB_ALLOWED_USER_IDS,
    );
  }
  return cachedAllowedGithubIds;
}

/**
 * The process-wide admin better-auth instance, or `null` when sign-in is unconfigured (any of
 * the auth database URL, session secret, or GitHub OAuth client id/secret is absent). Callers
 * MUST treat `null` as "sign-in unavailable" and fail closed — deny, never allow. Resolved once
 * and cached (one Postgres pool per process).
 */
export function getAdminAuth(): AdminAuthInstance | null {
  if (cachedAuth !== undefined) return cachedAuth;
  const url = process.env.ADMIN_AUTH_DATABASE_URL?.trim();
  const secret = process.env.ADMIN_BETTER_AUTH_SECRET?.trim();
  const clientId = process.env.ADMIN_GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.ADMIN_GITHUB_CLIENT_SECRET?.trim();
  if (
    url === undefined ||
    url.length === 0 ||
    secret === undefined ||
    secret.length === 0 ||
    clientId === undefined ||
    clientId.length === 0 ||
    clientSecret === undefined ||
    clientSecret.length === 0
  ) {
    cachedAuth = null;
    return cachedAuth;
  }
  const pool = new Pool({ connectionString: url });
  pool.on("error", (err) => {
    process.stderr.write(`[apps/admin] idle pg client error: ${err.message}\n`);
  });
  cachedAuth = createAdminAuth({
    database: pool,
    secret,
    githubClientId: clientId,
    githubClientSecret: clientSecret,
    allowedGithubIds: getAllowedGithubIds(),
    baseURL: process.env.ADMIN_BETTER_AUTH_URL?.trim(),
  });
  return cachedAuth;
}

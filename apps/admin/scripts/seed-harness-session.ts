#!/usr/bin/env bun
/**
 * Local admin auth harness — mint a REAL better-auth admin session WITHOUT GitHub OAuth.
 *
 * apps/admin is GitHub-OAuth-only (ADR-0283): there is no email+password path to script the way
 * apps/site's visual-harness does (signInProbeAccount). So the visual harness (Playwright shots of
 * authed admin pages) and the security pentest can't reach any /admin route on a real dev server.
 * This script closes that gap for LOCAL use only: it creates the user + github-account + session
 * rows straight through better-auth's own `internalAdapter`, then reconstructs the signed session
 * cookie the exact way better-call's `serializeSignedCookie` does — and proves the cookie by
 * replaying it through `auth.api.getSession` (the same read path `verifyAdminSession` uses).
 *
 * It points at the SAME Postgres the dev server reads, using ADMIN_AUTH_DIRECT_DATABASE_URL for
 * this migration-capable finite script while the server uses ADMIN_AUTH_DATABASE_URL. It signs
 * with the SAME ADMIN_BETTER_AUTH_SECRET — both processes must target the same database and secret
 * or the cookie won't verify. Drive it through tools/security/harness-admin.sh, which spins a
 * throwaway loopback Postgres and pins all three env vars for both this script and `bun dev`.
 *
 *   bun run apps/admin/scripts/seed-harness-session.ts
 *
 * Required env (all three identical to the dev server you'll point the harness at):
 *   ADMIN_AUTH_DIRECT_DATABASE_URL the direct admin better-auth DB (throwaway loopback PG for the harness)
 *   ADMIN_BETTER_AUTH_SECRET       the cookie HMAC key
 *   ADMIN_GITHUB_ALLOWED_USER_IDS  MUST include ADMIN_HARNESS_GITHUB_ID (else verifyAdminSession denies)
 * Optional:
 *   ADMIN_HARNESS_GITHUB_ID        harness sentinel GitHub numeric id (default 999999001)
 *   ADMIN_BETTER_AUTH_URL          dev-server origin the cookie targets (default http://localhost:3020)
 *   HARNESS_OUT                    Playwright storageState path (default apps/admin/.harness/admin-session.json)
 *
 * NOT product code — never imported by the app, only run as a script. Never run against a real DB:
 * it inserts a fake operator + open session. The throwaway loopback PG is the whole point.
 */
import { createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createPgPool } from "@caisson/tenancy-rls";
import { getMigrations } from "better-auth/db/migration";
import {
  createAdminAuth,
  getAllowedGithubIds,
} from "../src/lib/admin-auth-server.ts";

// The session cookie name = better-auth `cookiePrefix` ("caisson-admin", admin-auth-server.ts) +
// ".session_token". In dev (NODE_ENV != production) there is no `__Secure-` prefix — the harness
// only ever targets a local dev server, so the plain name is correct.
const COOKIE_NAME = "caisson-admin.session_token";

function requiredEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (v === undefined || v === "") {
    throw new Error(
      `${name} is required (source it from tools/security/harness-admin.sh, which pins the throwaway-PG values)`,
    );
  }
  return v;
}

/**
 * Reproduce better-call's `signCookieValue` (crypto.mjs): value = encodeURIComponent(
 * `${token}.${base64(HMAC-SHA256(secret, token))}`) — standard base64 (btoa), not base64url.
 * Reconstructed rather than imported because `signCookieValue` isn't a public better-auth export;
 * correctness is proven at the end by replaying the cookie through auth.api.getSession.
 */
function signSessionCookie(token: string, secret: string): string {
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  return encodeURIComponent(`${token}.${signature}`);
}

async function main(): Promise<void> {
  const databaseUrl = requiredEnv("ADMIN_AUTH_DIRECT_DATABASE_URL");
  const secret = requiredEnv("ADMIN_BETTER_AUTH_SECRET");
  // Fail loud if the running dev server's allowlist won't accept our sentinel — otherwise the
  // cookie would verify here but every real request would be denied by verifyAdminSession.
  requiredEnv("ADMIN_GITHUB_ALLOWED_USER_IDS");
  const harnessGithubId =
    process.env.ADMIN_HARNESS_GITHUB_ID?.trim() || "999999001";
  const baseUrl =
    process.env.ADMIN_BETTER_AUTH_URL?.trim() || "http://localhost:3020";
  const outPath = resolve(
    process.env.HARNESS_OUT?.trim() ||
      join(import.meta.dir, "..", ".harness", "admin-session.json"),
  );

  if (!getAllowedGithubIds().has(harnessGithubId)) {
    throw new Error(
      `ADMIN_GITHUB_ALLOWED_USER_IDS must include the harness id ${harnessGithubId} — the dev server will deny it otherwise`,
    );
  }

  const database = createPgPool(databaseUrl, { purpose: "migration" });

  try {
    const auth = createAdminAuth({
      database,
      secret,
      // The account.create.before allowlist hook (admin-auth-server.ts) fires on createAccount
      // below, so the harness instance's allowlist must contain the sentinel id.
      githubClientId: "harness",
      githubClientSecret: "harness",
      allowedGithubIds: new Set([harnessGithubId]),
      baseURL: baseUrl,
    });

    // Idempotent: creates user/session/account tables if the throwaway DB is fresh (the SAME
    // getMigrations().runMigrations() the preDeployCommand + the WR-02 pglite test run).
    const { runMigrations } = await getMigrations(auth.options);
    await runMigrations();

    const ctx = await auth.$context;
    const user = await ctx.internalAdapter.createUser({
      email: "harness-admin@caisson.sh",
      name: "Caisson Harness Admin",
      emailVerified: true,
    });
    await ctx.internalAdapter.createAccount({
      userId: user.id,
      providerId: "github",
      accountId: harnessGithubId,
    });
    const session = await ctx.internalAdapter.createSession(user.id, false);

    const cookieValue = signSessionCookie(session.token, secret);
    const cookieHeader = `${COOKIE_NAME}=${cookieValue}`;

    // The built-in check: replay the cookie through better-auth's real verifier. If the signed
    // value is wrong (HMAC preimage / encoding mismatch), getSession returns null and we abort
    // rather than write a storageState the dev server would silently reject.
    const verified = await auth.api.getSession({
      headers: new Headers({ cookie: cookieHeader }),
    });
    if (verified === null || verified.user.email !== user.email) {
      throw new Error(
        "reconstructed cookie failed auth.api.getSession — cookie signing is out of sync with better-auth",
      );
    }

    const storageState = {
      cookies: [
        {
          name: COOKIE_NAME,
          value: cookieValue,
          domain: new URL(baseUrl).hostname,
          path: "/",
          expires: Math.floor(session.expiresAt.getTime() / 1000),
          httpOnly: true,
          secure: false,
          sameSite: "Strict" as const,
        },
      ],
      origins: [] as const,
    };
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, JSON.stringify(storageState, null, 2));

    process.stdout.write(
      [
        `✓ admin harness session minted (github id ${harnessGithubId}, ${user.email})`,
        `  storageState → ${outPath}`,
        `  curl header  → -H 'Cookie: ${cookieHeader}'`,
        `  target       → ${baseUrl} (the server uses ADMIN_AUTH_DATABASE_URL; this script uses ADMIN_AUTH_DIRECT_DATABASE_URL)`,
        "",
      ].join("\n"),
    );
  } finally {
    await database.end();
  }
}

await main();

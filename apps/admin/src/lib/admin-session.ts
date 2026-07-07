// The per-request admin session gate (ADR-0283): re-verifies BOTH that a real better-auth session
// exists AND that its linked GitHub account is (still) on the numeric-id allowlist, on EVERY
// request — not just once at OAuth account-creation time. `admin-auth-server.ts`'s
// `databaseHooks.account.create.before` gate only fires when a NEW GitHub account first links; it
// can never re-fire for an account that already exists. This module is what gives ADR-0283's
// "session ... destroyed" half its teeth: if the operator narrows
// `ADMIN_GITHUB_ALLOWED_USER_IDS` after an account already exists, the very next request from
// that account is denied here, even though its cookie / DB session row is still technically live.
//
// `auth.api.listUserAccounts` is better-auth's own public, documented server API — not a raw
// query against its internally-managed `account` table, whose exact physical column/table names
// this app never pins (better-auth owns and migrates that schema itself). It returns every
// account linked to the CURRENT session's user, read live, on every call.
import { getAdminAuth, getAllowedGithubIds } from "./admin-auth-server.ts";
import { isAllowedGithubId } from "./admin-auth-config.ts";

export interface VerifiedAdminActor {
  /** The signed-in operator's email (ADR-0220 audit-trail actor), never blank. */
  readonly email: string;
}

/**
 * Verify the request carries a real better-auth session AND that its linked GitHub account is on
 * the CURRENT allowlist. Returns the verified actor identity or `null` — NEVER throws: an
 * unconfigured runtime (no admin auth DB / secret / GitHub credentials), no session cookie, an
 * expired/forged session, a GitHub account not in the allowlist, or any lookup error all collapse
 * to "no verified actor" so the caller fails closed (deny / redirect-to-login).
 */
export async function verifyAdminSession(
  req: Request,
): Promise<VerifiedAdminActor | null> {
  const auth = getAdminAuth();
  if (auth === null) return null;
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (session === null) return null;
    const accounts = await auth.api.listUserAccounts({ headers: req.headers });
    const github = accounts.find((a) => a.providerId === "github");
    if (
      github === undefined ||
      !isAllowedGithubId(github.accountId, getAllowedGithubIds())
    ) {
      return null;
    }
    const email = session.user.email.trim();
    // GitHub's `user:email` scope (better-auth's default) reliably yields a verified primary
    // email, but fall back to the immutable numeric id rather than ever return a blank actor —
    // an unattributable admin session must never look "verified" (mirrors the CF-Access-era
    // "no anonymous actor" stance this replaces).
    return { email: email.length > 0 ? email : github.accountId };
  } catch {
    return null;
  }
}

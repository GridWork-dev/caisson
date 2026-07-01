// The dashboard auth seam (ADR-0015). better-auth is the self-hosted SessionProvider; for a
// SAME-PROCESS read (the dashboard) `resolveSession` returns `{ userId, accountId, role }`
// straight from the better-auth server session (its `Secure; HttpOnly; SameSite=Strict` cookie,
// configured in `lib/auth-server.ts`). `requireDashboardSession` is the ONE call every dashboard
// route makes before any tenant read; its signature is unchanged so no route had to change.
//
// This supersedes the earlier placeholder that read a self-minted EdDSA `caisson_session` cookie:
// that cookie was a stand-in until the real sign-in flow existed. The EdDSA account JWT
// (`@caisson/auth`'s `jwt.ts`) remains the CROSS-SERVICE seam (execution-plane / buyer MCP), a
// separate concern from this same-process read.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { SessionContext } from "@caisson/auth";
import { getAuth } from "./auth-server.ts";

export { SESSION_COOKIE_NAME } from "./auth-server.ts";

/**
 * Resolve the current request's session from better-auth, mapped to the base `SessionContext`, or
 * `null`. Never throws — an unconfigured runtime (no DB/secret), no cookie, or an expired/forged
 * session all collapse to "no session" (fail closed): the caller redirects to `/login`.
 *
 * SEAM (account provisioning — see ADR-0132 / report): a signed-in buyer's tenant `accountId` is
 * keyed by their own `user.id` (a personal account) until org/membership provisioning lands. This
 * is the ONLY value the data layer trusts for RLS (`withTenant`, ADR-0005) and it is sourced
 * solely from the verified better-auth session here — never from a request param/body — so a
 * forged account id cannot cross tenants.
 */
export async function getSession(): Promise<SessionContext | null> {
  const auth = getAuth();
  if (auth === null) return null;
  try {
    const result = await auth.api.getSession({ headers: await headers() });
    if (result === null) return null;
    return {
      userId: result.user.id,
      accountId: result.user.id,
      role: "owner",
    };
  } catch {
    return null;
  }
}

/**
 * Require a session for an authed dashboard route; redirects to `/login?next=<pathname>` when
 * absent (never throws a 401 into a page render). `pathname` is the route requiring auth, used
 * only to return the buyer to where they started after sign-in.
 */
export async function requireDashboardSession(
  pathname: string,
): Promise<SessionContext> {
  const session = await getSession();
  if (session === null) {
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }
  return session;
}

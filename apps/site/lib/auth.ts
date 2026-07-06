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
import {
  type Role,
  type SessionContext,
  ensurePersonalAccount,
  resolveUserAccounts,
  selectActiveAccount,
} from "@caisson/auth";
import { getAuth } from "./auth-server.ts";
import { getDb } from "./db.ts";

export { SESSION_COOKIE_NAME } from "./auth-server.ts";

/**
 * Resolve the current request's session from better-auth, mapped to the base `SessionContext`, or
 * `null`. Never throws — an unconfigured runtime (no DB/secret), no cookie, or an expired/forged
 * session all collapse to "no session" (fail closed): the caller redirects to `/login`.
 *
 * ACCOUNT RESOLUTION (D4, ADR-0176): the tenant `accountId` is resolved from `account_member` — a
 * user with no membership row gets a personal account (account_id == user_id) created idempotently
 * on first resolution; org members resolve to their selected/oldest account. The account id is
 * still sourced solely from the verified better-auth session's user id (never a request param), so
 * a forged account id cannot cross tenants — `resolveActiveAccount` only ever reads accounts the
 * verified `userId` belongs to (user-scoped RLS via `withUser`). It is the ONLY value the data
 * layer trusts for RLS (`withTenant`, ADR-0005).
 */
export async function getSession(): Promise<SessionContext | null> {
  const auth = getAuth();
  if (auth === null) return null;
  try {
    const result = await auth.api.getSession({ headers: await headers() });
    if (result === null) return null;
    const userId = result.user.id;
    const { accountId, role } = await resolveActiveAccount(userId);
    return { userId, accountId, role };
  } catch {
    return null;
  }
}

/**
 * Resolve the signed-in user's active account via `account_member` (D4, ADR-0176). FAIL-SAFE: any
 * DB error — the table not yet migrated on this deploy, the pool down — falls back to the personal
 * account (account_id == user_id, role owner) so an authed dashboard render never breaks. Existing
 * single-user tenants (no membership row) resolve to exactly that personal account, unchanged.
 */
async function resolveActiveAccount(
  userId: string,
): Promise<{ accountId: string; role: Role }> {
  const personal = { accountId: userId, role: "owner" as Role };
  try {
    const db = await getDb();
    let memberships = await resolveUserAccounts(db, userId);
    if (memberships.length === 0) {
      await ensurePersonalAccount(db, userId);
      memberships = await resolveUserAccounts(db, userId);
    }
    const active = selectActiveAccount(memberships);
    return active
      ? { accountId: active.accountId, role: active.role }
      : personal;
  } catch {
    return personal;
  }
}

/**
 * Owner-only gate for org-mutating writes (CWE-863 broken-access-control — ADR-0208 decision 1).
 * BYOK provider-key rotation and compliance-attestation writes require the account OWNER role:
 * a seat member must not rotate the org's provider keys or rewrite the attestations that feed
 * the SAR/POA&M export. Reads (masked key metadata, attestation state) stay seat-visible — gate
 * only the writes. Roles are `owner | seat` (`account_member`, ADR-0176); the role comes from
 * the verified session, never a request param. Mirrors the members-page owner gate.
 */
export function isOwner(session: SessionContext): boolean {
  return session.role === "owner";
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

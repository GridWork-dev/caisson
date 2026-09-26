// Account membership resolution + authz (ADR-0176). Everything below the session layer already keys
// on the opaque `account_id`; this module is the identity→account indirection that was 1:1 (personal)
// and is now many-to-many (org). Pure selection logic + RLS-scoped stores over `account_member`
// (schema.ts). No schema change anywhere else — withTenant/RLS/entitlements/licenses are untouched.
//
// SCOPE (ADR-0257 §1.3): this file keeps only the login-critical SESSION-RESOLUTION half
// (`resolveUserAccounts` / `ensurePersonalAccount` / `selectActiveAccount`) — it runs on every buyer
// login (apps/site getSession), so it stays in the open Apache-2.0 substrate. The owner-gated MANAGE
// half (`listAccountMembers` / `addAccountMember` / `assertCanManageMembers`) moved to the commercial
// `@caisson-sh/org-controls`, which re-uses `AccountMembership` + `Role` from here.
import { withTenant, withUser, type Transactor } from "@caisson-sh/tenancy-rls";

import type { Role } from "./session.ts";

export interface AccountMembership {
  accountId: string;
  userId: string;
  role: Role;
}

interface MemberRow {
  account_id: string;
  user_id: string;
  role: string;
}

function toMembership(r: MemberRow): AccountMembership {
  // `role` is DB-constrained to owner|seat (schema.ts CHECK), so the cast is sound.
  return { accountId: r.account_id, userId: r.user_id, role: r.role as Role };
}

/**
 * Every account a signed-in user belongs to (the login-resolution path — user-scoped RLS via
 * `withUser`, so a user reads ONLY their own memberships). Ordered oldest-first (personal account,
 * created at first sign-in, sorts first).
 */
export async function resolveUserAccounts(
  db: Transactor,
  userId: string,
): Promise<AccountMembership[]> {
  return withUser(db, userId, async (tx) => {
    const { rows } = await tx.query<MemberRow>(
      `SELECT account_id, user_id, role FROM account_member WHERE user_id = $1 ORDER BY created_at`,
      [userId],
    );
    return rows.map(toMembership);
  });
}

/**
 * Guarantee a user has at least a personal account (account_id == user_id, role owner) — created on
 * first sign-in so an existing single-user tenant keeps working unchanged. Idempotent. Runs
 * account-scoped (withTenant on the user's own id) so the WITH CHECK is satisfied.
 */
export async function ensurePersonalAccount(
  db: Transactor,
  userId: string,
): Promise<void> {
  await withTenant(db, userId, async (tx) => {
    await tx.query(
      `INSERT INTO account_member (account_id, user_id, role)
       VALUES ($1, $1, 'owner') ON CONFLICT DO NOTHING`,
      [userId],
    );
  });
}

/**
 * Pure: pick the active account from a user's memberships + an optional requested id (from a signed
 * active-account cookie/claim). Falls back to the personal account (account_id == user_id), else the
 * first (oldest) membership. `null` only when the user has no memberships.
 */
export function selectActiveAccount(
  memberships: readonly AccountMembership[],
  requestedAccountId?: string,
): AccountMembership | null {
  if (memberships.length === 0) return null;
  if (requestedAccountId !== undefined) {
    const match = memberships.find((m) => m.accountId === requestedAccountId);
    if (match) return match;
  }
  // length>0 is guaranteed above, but noUncheckedIndexedAccess types memberships[0] as possibly
  // undefined — the trailing `?? null` satisfies the AccountMembership | null return.
  return (
    memberships.find((m) => m.accountId === m.userId) ?? memberships[0] ?? null
  );
}

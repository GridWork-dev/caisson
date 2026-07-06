// The owner-gated multi-user membership surface (ADR-0176), carved out of the open @caisson/auth into
// this commercial package (ADR-0257 §1.3). Only the MANAGE half moves: listing an account's members,
// an owner adding a seat, and the owner-only authz gate. The login-critical session-resolution half
// (`resolveUserAccounts` / `ensurePersonalAccount` / `selectActiveAccount`) STAYS in open @caisson/auth
// — it runs on every buyer login (apps/site getSession), so it must never sit behind the org-controls
// entitlement. `AccountMembership` + `Role` are re-used from @caisson/auth (their canonical home);
// this package composes DOWN onto the open auth + tenancy-rls substrates (commercial → open, allowed).
import { AuthzError } from "@caisson/kernel";
import { withTenant, type Transactor } from "@caisson/tenancy-rls";
import type { AccountMembership, Role } from "@caisson/auth";

interface MemberRow {
  account_id: string;
  user_id: string;
  role: string;
}

// A 3-line mapper duplicated from @caisson/auth's membership.ts rather than widening the open auth
// API with a new export just for it. `role` is DB-constrained to owner|seat (schema.ts CHECK), so
// the cast is sound.
function toMembership(r: MemberRow): AccountMembership {
  return { accountId: r.account_id, userId: r.user_id, role: r.role as Role };
}

/** Owner-only gate for member/billing management (ADR-0176 — seats cannot manage). */
export function assertCanManageMembers(role: Role): void {
  if (role !== "owner") {
    throw new AuthzError("Only an account owner can manage members or billing");
  }
}

/** List the members of an account (member-management path — tenant-scoped via `withTenant`). */
export async function listAccountMembers(
  db: Transactor,
  accountId: string,
): Promise<AccountMembership[]> {
  return withTenant(db, accountId, async (tx) => {
    const { rows } = await tx.query<MemberRow>(
      `SELECT account_id, user_id, role FROM account_member ORDER BY created_at`,
    );
    return rows.map(toMembership);
  });
}

/**
 * An owner adds a member (default role `seat`) to their account — tenant-scoped write, owner-gated.
 * `actorRole` is the caller's role in `accountId` (from their resolved session). Idempotent.
 */
export async function addAccountMember(
  db: Transactor,
  actorRole: Role,
  accountId: string,
  userId: string,
  role: Role = "seat",
): Promise<void> {
  assertCanManageMembers(actorRole);
  await withTenant(db, accountId, async (tx) => {
    await tx.query(
      `INSERT INTO account_member (account_id, user_id, role)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [accountId, userId, role],
    );
  });
}

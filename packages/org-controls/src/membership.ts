// The owner-gated multi-user membership surface (ADR-0176), carved out of the open @caisson-sh/auth into
// this commercial package (ADR-0257 §1.3). Only the MANAGE half moves: listing an account's members,
// an owner adding a seat, and the owner-only authz gate. The login-critical session-resolution half
// (`resolveUserAccounts` / `ensurePersonalAccount` / `selectActiveAccount`) STAYS in open @caisson-sh/auth
// — it runs on every buyer login (apps/site getSession), so it must never sit behind the org-controls
// entitlement. `AccountMembership` + `Role` are re-used from @caisson-sh/auth (their canonical home);
// this package composes DOWN onto the open auth + tenancy-rls substrates (commercial → open, allowed).
import { ValidationError } from "@caisson-sh/kernel";
import { withTenant, type Transactor } from "@caisson-sh/tenancy-rls";
import type { AccountMembership, Role } from "@caisson-sh/auth";
import { assertCanManageMembers } from "./gate.ts";

// The gate itself lives in gate.ts (ADR-0396) so the browser entry can carry it without this
// module's `pg`-bound writes; re-exported here so `.` and every existing import path are unchanged.
export { assertCanManageMembers };

interface MemberRow {
  account_id: string;
  user_id: string;
  role: string;
}

// A 3-line mapper duplicated from @caisson-sh/auth's membership.ts rather than widening the open auth
// API with a new export just for it. `role` is DB-constrained to owner|seat (schema.ts CHECK), so
// the cast is sound.
function toMembership(r: MemberRow): AccountMembership {
  return { accountId: r.account_id, userId: r.user_id, role: r.role as Role };
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

/**
 * An owner removes a member's seat (G15 — offboarding never shipped; the schema has GRANTed DELETE
 * on `account_member` since ADR-0176, unused until now). Owner-gated (`assertCanManageMembers`,
 * same authz as `addAccountMember`); self-removal is refused so an owner can never lock themselves
 * out of their own account through this control (the personal-account row where
 * `accountId === userId` is exempt for the same reason — it is not a seat to remove). A SECOND
 * owner cannot be removed this way either (`addAccountMember` accepts `role: "owner"`, so a
 * multi-owner account is possible): removal is a seat-offboarding control, not a co-owner ejection
 * — refuse it the same way self-removal is refused rather than let one owner unilaterally strip
 * another's access. The target's role is looked up inside the SAME tenant-scoped transaction the
 * delete runs in, so the check and the write see a consistent row. Idempotent: removing an id that
 * is not a member is a no-op, not an error.
 */
export async function removeAccountMember(
  db: Transactor,
  actorRole: Role,
  actorUserId: string,
  accountId: string,
  targetUserId: string,
): Promise<void> {
  assertCanManageMembers(actorRole);
  if (targetUserId === actorUserId) {
    throw new ValidationError("You cannot remove yourself from an account", {
      field: "userId",
    });
  }
  await withTenant(db, accountId, async (tx) => {
    const { rows } = await tx.query<{ role: string }>(
      `SELECT role FROM account_member WHERE account_id = $1 AND user_id = $2`,
      [accountId, targetUserId],
    );
    const targetRole = rows[0]?.role;
    if (targetRole === undefined) return; // not a member — idempotent no-op
    if (targetRole === "owner") {
      throw new ValidationError("An account owner cannot be removed this way", {
        field: "userId",
      });
    }
    await tx.query(
      `DELETE FROM account_member WHERE account_id = $1 AND user_id = $2`,
      [accountId, targetUserId],
    );
  });
}

// The account-membership schema (ADR-0176 — adopter accounts are multi-user organizations). The tenant
// key stays the opaque `account_id` (nothing downstream changed); this table is the ONLY new schema —
// it resolves which users belong to an account and with what role. In prod this is a numbered Drizzle
// migration (ADR-0014); the DDL is owned here (the credits/schema.ts pattern).
//
// RLS is dual-GUC (ADR-0005 fail-closed, both paths):
//   • member-list path  — `withTenant(accountId)` binds the account GUC → an owner lists their account's
//     members;
//   • login path        — `withUser(userId)` binds the user GUC → a signed-in user reads their OWN
//     memberships across accounts to resolve the active one (the account GUC is null on this path, so
//     the account clause is false — the two paths never widen each other).
// Writes are account-scoped only (WITH CHECK on the account GUC): a member row can be inserted only by
// a caller holding the account GUC (an owner via withTenant, or the user themselves for their personal
// account where account_id == user_id). A seat cannot self-insert into another account.
import { TENANT_GUC, USER_GUC } from "@caisson-sh/tenancy-rls";

export const ACCOUNT_MEMBER_SCHEMA_SQL = `
CREATE TABLE account_member (
  account_id text NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, user_id),
  CONSTRAINT account_member_role_valid CHECK (role IN ('owner', 'seat'))
);

-- The login-resolution lookup is keyed by user_id (spans accounts).
CREATE INDEX account_member_user_idx ON account_member (user_id);

ALTER TABLE account_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_member FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON account_member TO app;

CREATE POLICY account_member_isolation ON account_member
  USING (
    account_id = current_setting('${TENANT_GUC}', true)
    OR user_id = current_setting('${USER_GUC}', true)
  )
  WITH CHECK (account_id = current_setting('${TENANT_GUC}', true));
`;

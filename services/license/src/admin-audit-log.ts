// The operator-facing half of the ADR-0220 dual audit log. Every admin mutation writes BOTH a
// per-tenant WORM chain entry (tamper-evident evidence, @caisson/audit-worm) AND one row here — a
// queryable, cross-tenant "who did what" list the operator browses from apps/admin. This table is
// NOT tenant-scoped (it spans every tenant by design), so it carries no RLS tenant policy; access
// is role-gated instead: `admin_write` may INSERT (written in the SAME transaction as the mutation,
// so a rolled-back mutation writes no log row), the read-only `admin` role may SELECT (the cockpit
// reads it through ADR-0141's `withAdminRead`), and the buyer `app` role is granted nothing — it
// can never see the operator log.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { TenantExecutor } from "@caisson/tenancy-rls";

/**
 * The locked operator actions. The four v1 actions (ADR-0220, Fork AM-1 = A; the buyer-lookup 5th is
 * dropped) plus `purchase_revoke` (ADR-0225, Fork R-5 = A): the v2 revoke of a REAL paid one-time
 * purchase — kept a DISTINCT action from `entitlement_revoke` (which MEANS comp-only) so a chargeback
 * dispute can filter "show me every paid revoke" without parsing JSON. Its own before/after money
 * snapshot captures the credit claw + the edge deny-set in one auditable event (no separate row).
 * `license_first_mint` (the buyer-lifecycle-audit G1 rescue lever, ADR-0292): a DISTINCT action from
 * `license_reissue` (which MEANS re-serve-an-existing-token-only) so the two never conflate in the log.
 * `email_resend` (G40): a resend of the purchase-confirmation-style email to the account's own address.
 * `system_mode`: the operator read-only lever — the LATEST `system_mode` row's `payload_after.mode`
 * IS the persisted system write-mode every other mutation consults (the log doubles as the store:
 * flipping the lever is itself a logged admin action, so the mode is audit-trailed by construction).
 * `license_rotate`: TRUE key rotation — the OLD licenseId enters the edge deny-set and a FRESH key
 * is minted; distinct from `license_reissue` (re-serve-only, the compromised-key case reissue can
 * never fix) and `license_first_mint` (no prior grant exists).
 * `intel_review` / `intel_dismiss` (ADR-0316 F5): the operator triaged an `intel.findings` row —
 * these two carry NO tenant account (a single-operator control-plane store), so they log under the
 * synthetic `intel` target and anchor the WORM chain there, mirroring `system_mode`'s `system`.
 * `affiliate_mint` (ADR-0315/0320): the operator minted an affiliate discount code — also
 * account-less, logged under the synthetic `affiliate` target.
 * `audit_proof_read` (ADR-0344 / per-row verification): the operator READ one tenant row's proof
 * bundle through the admin proof-bundle endpoint. Unlike every other action here it records a READ,
 * not a mutation, so it appends NO WORM entry — a cross-tenant read of a customer's cryptographic
 * audit material is a sensitive access the customer-trust + insider-threat story wants recorded (M1),
 * logged under the RAW target account the operator inspected.
 */
export const ADMIN_ACTIONS = [
  "entitlement_grant",
  "entitlement_revoke",
  "credit_adjust",
  "license_reissue",
  "purchase_revoke",
  "license_first_mint",
  "email_resend",
  "system_mode",
  "license_rotate",
  "intel_review",
  "intel_dismiss",
  "affiliate_mint",
  "audit_proof_read",
] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];

/** Closed schema for the action discriminator — an unregistered action can never be logged. */
export const AdminActionSchema = z.enum(ADMIN_ACTIONS);

export const ADMIN_ACTION_LOG_SCHEMA_SQL = `
CREATE TABLE admin_action_log (
  id text PRIMARY KEY,
  actor_email text NOT NULL,
  target_account_id text NOT NULL,
  action text NOT NULL,
  payload_before jsonb,
  payload_after jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_action_log_action CHECK (action IN ('entitlement_grant', 'entitlement_revoke', 'credit_adjust', 'license_reissue', 'purchase_revoke', 'license_first_mint', 'email_resend', 'system_mode', 'license_rotate', 'intel_review', 'intel_dismiss', 'affiliate_mint', 'audit_proof_read'))
);
GRANT INSERT ON admin_action_log TO admin_write;
GRANT SELECT ON admin_action_log TO admin;
`;

// ADR-0225 (Fork R-5 = A), widened again for `license_first_mint` + `email_resend` (buyer-lifecycle
// audit wave), and again for `intel_review`/`intel_dismiss`/`affiliate_mint` (Kickoff-N, ADR-0316
// F5 + ADR-0315/0320), and again for `audit_proof_read` (ADR-0344 per-row verification). The
// forward migration that widens the action-enum CHECK to admit new actions on an
// environment that already created `admin_action_log` under an older CHECK (ADR-0220). Idempotent
// (DROP IF EXISTS → ADD), additive, and — crucially — NOT an edit to the checksum-pinned CREATE above:
// mirrors `ENTITLEMENT_ADMIN_COMP_MIGRATION_SQL`'s append-a-migration convention (ADR-0014, never
// rewrite a shipped DDL). Applied at the operator-gated admin DEPLOY (the same step that runs
// `ADMIN_ACTION_LOG_SCHEMA_SQL` + `ADMIN_MUTATION_PROVISION_SQL` on the Railway PG) and in the
// apps/admin PGlite dev/test double AFTER the schema constant, where it is a no-op — the fresh CHECK
// already lists every action. `admin_action_log` is NOT part of the apps/site platform migrate set
// (deploy-migrate.ts) — it is admin-DEPLOY-provisioned — so this rides the admin DEPLOY, not the
// platform runner.
export const ADMIN_ACTION_LOG_ACTION_MIGRATION_SQL = `
ALTER TABLE admin_action_log DROP CONSTRAINT IF EXISTS admin_action_log_action;
ALTER TABLE admin_action_log ADD CONSTRAINT admin_action_log_action
  CHECK (action IN ('entitlement_grant', 'entitlement_revoke', 'credit_adjust', 'license_reissue', 'purchase_revoke', 'license_first_mint', 'email_resend', 'system_mode', 'license_rotate', 'intel_review', 'intel_dismiss', 'affiliate_mint', 'audit_proof_read'));
`;

export interface AdminActionLogInput {
  actorEmail: string;
  targetAccountId: string;
  action: AdminAction;
  /** State snapshot before the mutation (JSON-serializable) — null when there is no prior state. */
  before: unknown;
  /** State snapshot after the mutation (JSON-serializable). */
  after: unknown;
  /**
   * Pin the row id instead of minting one, so a caller can reference this action's id from a related
   * row written in the SAME transaction (ADR-0225: `license_revocation.admin_action_id` is an
   * FK-by-value to this id). Omitted → a fresh `randomUUID()` (every v1 caller's shape, unchanged).
   */
  id?: string;
}

/**
 * Insert one operator-action row. Runs inside the SAME `withAdminWrite` transaction as the mutation
 * it records, so the two are atomic: a mutation that throws rolls this back too (neither logged).
 */
export async function insertAdminActionLog(
  tx: TenantExecutor,
  input: AdminActionLogInput,
): Promise<string> {
  const id = input.id ?? randomUUID();
  await tx.query(
    `INSERT INTO admin_action_log
       (id, actor_email, target_account_id, action, payload_before, payload_after)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
    [
      id,
      input.actorEmail,
      input.targetAccountId,
      input.action,
      JSON.stringify(input.before ?? null),
      JSON.stringify(input.after ?? null),
    ],
  );
  return id;
}

export interface AdminActionLogRow {
  id: string;
  actorEmail: string;
  targetAccountId: string;
  action: string;
  createdAt: string;
}

/**
 * Read the most-recent operator actions, newest first — the cockpit's audit browser. Runs through
 * ADR-0141's `withAdminRead` (the SELECT-only `admin` role). Payloads are omitted from the list
 * view (a before/after snapshot can be large); the id + who/what/when is the browse surface.
 */
export async function readAdminActionLog(
  tx: TenantExecutor,
  limit = 100,
): Promise<AdminActionLogRow[]> {
  const bounded = Math.min(Math.max(Math.trunc(limit), 1), 500);
  const r = await tx.query<{
    id: string;
    actor_email: string;
    target_account_id: string;
    action: string;
    created_at: unknown;
  }>(
    `SELECT id, actor_email, target_account_id, action, created_at
       FROM admin_action_log
      ORDER BY created_at DESC, id DESC
      LIMIT $1`,
    [bounded],
  );
  return r.rows.map((row) => ({
    id: row.id,
    actorEmail: row.actor_email,
    targetAccountId: row.target_account_id,
    action: row.action,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  }));
}

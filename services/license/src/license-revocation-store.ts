// The ADR-0225 (Fork R-4 = B) edge revocation-truth table — the DB half of the CRL-style deny-set the
// registry Worker reads to kill a revoked buyer's OFFLINE license access. A DB entitlement revoke is
// invisible to the Worker (it verifies a SIGNED offline token against a baked Ed25519 pubkey, never a
// live DB read), so a fraud/ToS revoke also writes a row here keyed on the ONE stable identifier the
// signed token verifiably carries: `claims.licenseId` (packages/license-verify claims — the token has
// NO accountId, so licenseId is the only edge-matchable key). A license token is minted per
// (account, major) over the account's FULL entitlement set, so an edge deny is license-scoped =
// account-scoped in practice: revoking a paid purchase denies EVERY license the account holds (the
// right posture for the fraud/chargeback/ToS case this exists for; the refcount-survivor reissue-
// rotation nuance is Fork R-4 = C, deferred).
//
// NOT tenant-scoped — like `admin_action_log`, this is an operator artifact spanning tenants, so it
// carries no RLS tenant policy; access is role-gated by GRANT instead (`admin_write` INSERT/SELECT,
// the read-only `admin` role SELECT, the buyer `app` role nothing). The PK on `license_id` makes a
// re-revoke idempotent (`ON CONFLICT DO NOTHING`). The CREATE + GRANTs are applied at the
// operator-gated admin DEPLOY (Railway PG) and in the apps/admin PGlite dev/test double — never
// embedded in a buyer-path schema constant.
//
// Publishing this truth to an artifact the Worker fetches (an R2 object / inlined asset, injected +
// fail-open) is a SEPARATE slice (the admin runtime + the Worker reader) — this module owns only the
// in-transaction DB write + the deny-set read.
import type { TenantExecutor } from "@caisson/tenancy-rls";

export const LICENSE_REVOCATION_SCHEMA_SQL = `
CREATE TABLE license_revocation (
  license_id text PRIMARY KEY,
  account_id text NOT NULL,
  admin_action_id text,
  reason text,
  revoked_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT, SELECT ON license_revocation TO admin_write;
GRANT SELECT ON license_revocation TO admin;
`;

export interface RecordLicenseRevocationsInput {
  /** The target account whose held licenses are being denied at the edge. */
  accountId: string;
  /** The `admin_action_log.id` of the driving `purchase_revoke` action (FK-by-value, audit link). */
  adminActionId: string;
  /** Operator-supplied cause (fraud / chargeback / ToS) — the WORM-evidence "why"; null when absent. */
  reason?: string | null;
}

/**
 * Record the edge deny-set truth for a paid revoke (ADR-0225 Fork R-4 = B). Reads EVERY license the
 * account holds (all majors) from `license_grant` — each `license_id` is a signed-claim key the Worker
 * can match offline — and inserts one `license_revocation` row per license id, idempotently
 * (`ON CONFLICT (license_id) DO NOTHING`, so a re-revoke or an already-denied license is a no-op).
 * Returns the FULL set of license ids now denied for the account (stable across a re-run: the read is
 * fresh each time), for the driving action's audit snapshot + the downstream publish. Must run inside
 * `withAdminWrite(db, …)` — it reads `license_grant` cross-tenant (SELECT-only admin_write policy) and
 * writes the role-gated `license_revocation`, both bounded to the caller's one target account.
 */
export async function recordLicenseRevocations(
  tx: TenantExecutor,
  input: RecordLicenseRevocationsInput,
): Promise<string[]> {
  const grants = await tx.query<{ license_id: string }>(
    `SELECT DISTINCT license_id FROM license_grant WHERE account_id = $1`,
    [input.accountId],
  );
  const licenseIds = grants.rows.map((row) => row.license_id);
  for (const licenseId of licenseIds) {
    await recordLicenseRevocation(tx, {
      licenseId,
      accountId: input.accountId,
      adminActionId: input.adminActionId,
      reason: input.reason ?? null,
    });
  }
  return licenseIds;
}

export interface RecordLicenseRevocationInput {
  /** The ONE license id being denied at the edge (key rotation: the OLD key). */
  licenseId: string;
  /** The account holding it (audit column; the deny-set itself keys on license_id alone). */
  accountId: string;
  /** The `admin_action_log.id` of the driving action (FK-by-value, audit link). */
  adminActionId: string;
  /** Operator-supplied cause — null when absent. */
  reason?: string | null;
}

/**
 * Record ONE license id into the edge deny-set truth — the key-ROTATION revoke: unlike
 * {@link recordLicenseRevocations} (which denies EVERY license the account holds, the fraud/ToS
 * account-kill posture), a rotation denies exactly the key being rotated away, so the buyer's
 * other majors' licenses stay live. Idempotent (`ON CONFLICT (license_id) DO NOTHING` on the PK) —
 * a retried rotation re-denies as a no-op. Must run inside `withAdminWrite(db, …)`.
 */
export async function recordLicenseRevocation(
  tx: TenantExecutor,
  input: RecordLicenseRevocationInput,
): Promise<void> {
  await tx.query(
    `INSERT INTO license_revocation (license_id, account_id, admin_action_id, reason)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (license_id) DO NOTHING`,
    [
      input.licenseId,
      input.accountId,
      input.adminActionId,
      input.reason ?? null,
    ],
  );
}

/**
 * Read the full current edge deny-set — every revoked license id across all tenants — for the
 * downstream publish path (the admin runtime republishes the WHOLE set as an artifact the Worker
 * reads; operator actions are low-volume, so republish-whole beats a delta protocol). Run as the
 * `admin_write` or read-only `admin` role (the table is role-gated, not tenant-scoped).
 */
export async function readDenySet(tx: TenantExecutor): Promise<string[]> {
  const r = await tx.query<{ license_id: string }>(
    `SELECT license_id FROM license_revocation ORDER BY license_id`,
  );
  return r.rows.map((row) => row.license_id);
}

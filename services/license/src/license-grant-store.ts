// The append-only ISSUED-LICENSE store (implements ADR-0110/ADR-0010, "persist & reuse"). One row
// per (account, major) — the license major version a buyer is entitled to a perpetual token for.
// POST /issue is otherwise unbounded: a naive re-mint on every call would proliferate fresh
// perpetual Ed25519 tokens (each independently valid forever, ADR-0110) for the SAME purchase, with
// no way to tell which is "the" license. Persisting the FIRST minted token and re-serving it
// byte-identical on every later call for the same (account, major) makes /issue idempotent — exactly
// one stored grant per major per account — while a NEW major (a version bump) mints + stores its own.
//
// Append-only, with ONE sanctioned update path (ADR-0251 Decision 3): when the account's computed
// per-entitlement updates windows differ from the stored token's `updatesWindows` claim (ADR-0255)
// — a renewal purchase landed — /issue re-mints and `updateLicenseGrantToken` REPLACES the stored
// row's token in place (still one
// row per (account, major); the superseded token remains offline-valid, exactly like a re-issue).
// No delete path. The unique index on (account_id, major) is the idempotency anchor:
// `storeLicenseGrant`'s `ON CONFLICT DO NOTHING` absorbs a racing duplicate /issue call exactly like
// `grantEntitlements`/`checkRateLimit` absorb theirs — a losing caller's insert is silently dropped
// and re-reads via `readLicenseGrant` to discover the winner's token.
//
// Tenant-owned + fail-closed RLS via @caisson/tenancy-rls (ADR-0005), mirroring entitlement-store
// and rate-limit-store: every read/write runs inside `withTenant`, scoped to the buyer's account;
// the policy WITH CHECK rejects a cross-tenant write, and a read that forgets its WHERE still sees
// only the caller's rows.
import { randomUUID } from "node:crypto";
import { LICENSE_GRANT_SELECT_COLUMNS } from "@caisson/platform-reads";
import type { TenantExecutor } from "@caisson/tenancy-rls";
import { buildTenantPolicySql } from "@caisson/tenancy-rls";

// One row per (account, major) — the idempotency anchor is the unique index below. `token` stores
// the FULL signed wire string (`PREFIX-TIER-base64url(payload‖signature)`), not just a hash: a
// re-serve must return BYTE-IDENTICAL bytes, and the token is not a secret — it is already returned
// to the caller in the original 200 response and is independently offline-verifiable via the public
// key (`@caisson/license-verify`), so storing it carries no incremental disclosure risk. `license_id`
// and `tier` are kept alongside it (the claims' own provenance) so a re-serve never has to decode the
// wire token to answer the API's `{ token, licenseId }` shape.
export const LICENSE_GRANT_SCHEMA_SQL = `
CREATE TABLE license_grant (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  major integer NOT NULL,
  license_id text NOT NULL,
  tier text NOT NULL,
  expiry timestamptz,
  token text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT license_grant_major_nonneg CHECK (major >= 0)
);

CREATE UNIQUE INDEX license_grant_account_major_uniq
  ON license_grant (account_id, major);

${buildTenantPolicySql("license_grant")}
`;

/** One persisted issued-license grant, as read back for an idempotent re-serve. */
export interface LicenseGrantRecord {
  readonly id: string;
  readonly accountId: string;
  readonly major: number;
  readonly licenseId: string;
  readonly tier: string;
  /** ISO-8601 instant or null (perpetual-per-major) — the same value that was signed into the token. */
  readonly expiry: string | null;
  readonly token: string;
  readonly issuedAt: string;
}

export interface StoreLicenseGrantInput {
  /** The buyer account — MUST equal the `withTenant` scope (the RLS WITH CHECK enforces it). */
  accountId: string;
  /** The license major version this grant covers — the idempotency key together with accountId. */
  major: number;
  /** The minted claims' licenseId (randomUUID) — echoed back to the caller on a re-serve. */
  licenseId: string;
  tier: string;
  /** ISO-8601 instant or null (perpetual-per-major) — the same value signed into the token. */
  expiry: string | null;
  /** The full signed wire token — re-served byte-identical on a repeat /issue. */
  token: string;
}

/**
 * Idempotently persist a newly minted grant for (accountId, major). `ON CONFLICT DO NOTHING` on the
 * unique (account_id, major) index absorbs a racing duplicate /issue call — the first insert to
 * commit wins; a losing caller's insert is silently dropped and must `readLicenseGrant` to discover
 * the winner's stored token. Returns whether THIS call's row was the one persisted (false means a
 * grant for (accountId, major) already existed — race-lost, never re-minted here). Must run inside
 * `withTenant(db, accountId, …)`.
 */
export async function storeLicenseGrant(
  tx: TenantExecutor,
  input: StoreLicenseGrantInput,
): Promise<boolean> {
  const r = await tx.query<{ id: string }>(
    `INSERT INTO license_grant (id, account_id, major, license_id, tier, expiry, token)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (account_id, major) DO NOTHING
     RETURNING id`,
    [
      randomUUID(),
      input.accountId,
      input.major,
      input.licenseId,
      input.tier,
      input.expiry,
      input.token,
    ],
  );
  return r.rows.length > 0;
}

/**
 * Replace the stored token for an EXISTING (accountId, major) grant — the ADR-0251 Decision 3
 * re-mint path: the account's computed updates window changed (a renewal purchase), so /issue
 * minted a fresh token and this persists it over the stale one (same row, new license_id/token/
 * issued_at). Returns the number of rows updated (0 = no grant existed — the caller should have
 * inserted instead). Must run inside `withTenant(db, accountId, …)`.
 */
export async function updateLicenseGrantToken(
  tx: TenantExecutor,
  input: StoreLicenseGrantInput,
): Promise<number> {
  const r = await tx.query<{ id: string }>(
    `UPDATE license_grant
        SET license_id = $3, tier = $4, expiry = $5, token = $6, issued_at = now()
      WHERE account_id = $1 AND major = $2
      RETURNING id`,
    [
      input.accountId,
      input.major,
      input.licenseId,
      input.tier,
      input.expiry,
      input.token,
    ],
  );
  return r.rows.length;
}

/**
 * Read the stored grant for (accountId, major), if any — the idempotent-re-serve lookup `POST
 * /issue` runs BEFORE minting anything (and again after a lost insert race). RLS scopes the result
 * to the bound account; the explicit `account_id` predicate is belt-and-suspenders over that gate,
 * mirroring `readEntitlements`. Must run inside `withTenant(db, accountId, …)`.
 */
export async function readLicenseGrant(
  tx: TenantExecutor,
  accountId: string,
  major: number,
): Promise<LicenseGrantRecord | null> {
  const r = await tx.query<{
    id: string;
    account_id: string;
    major: number;
    license_id: string;
    tier: string;
    expiry: string | null;
    token: string;
    issued_at: string;
  }>(
    `SELECT id, account_id, ${LICENSE_GRANT_SELECT_COLUMNS.join(", ")}
     FROM license_grant
     WHERE account_id = $1 AND major = $2`,
    [accountId, major],
  );
  const row = r.rows[0];
  if (row === undefined) return null;
  return {
    id: row.id,
    accountId: row.account_id,
    major: row.major,
    licenseId: row.license_id,
    tier: row.tier,
    expiry: row.expiry,
    token: row.token,
    issuedAt: row.issued_at,
  };
}

// Dashboard tenant reads (ADR-0114 scope item 6). Every function here runs inside `readScoped`
// (lib/db.ts -> withTenant, ADR-0005 fail-closed RLS) and returns plain data the `/dashboard`
// views render through the `@caisson/ui` kit — no mock data.
//
// FLAGGED COUPLING: `readEntitlementGrants` and `readLicenseGrantRow` query `entitlement_grant` /
// `license_grant` directly via raw SQL — tables OWNED by `services/license` (a separately
// deployed service, `@caisson/service-license`). apps/site does not import that service's query
// functions (entitlement-store.ts / license-grant-store.ts); it knows the table SHAPE, not the
// service's business logic, which is the smaller and more honest coupling for two independently
// deployable surfaces that share one Postgres. The schema SQL constants ARE shared (lib/db.ts's
// dev bootstrap imports `ENTITLEMENT_SCHEMA_SQL`/`LICENSE_GRANT_SCHEMA_SQL` from
// `@caisson/service-license` rather than hand-copying the DDL a third time) — only the QUERIES
// are duplicated here. The future fix is a shared `@caisson/platform-reads` (or similar) package
// both apps/site and services/license depend on, exporting typed read-only query functions over
// these tables; until that exists, a column rename in either schema silently desyncs the other
// side's raw SQL with no compiler signal — grep for `entitlement_grant`/`license_grant` across
// both trees before changing either schema.
import { balance, getLedger } from "@caisson/credits";
import type { TenantExecutor } from "@caisson/tenancy-rls";

/** `timestamptz` columns come back as a driver-native `Date` instance on both PGlite and
 * node-postgres, never a string — normalize explicitly at every raw-SQL read boundary in this
 * file rather than trust the declared row type (mirrors the fix in `@caisson/credits#getLedger`). */
function toIsoString(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function toIsoStringOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : toIsoString(value);
}

export interface EntitlementGrantRow {
  entitlementId: string;
  sourceKind: "subscription" | "one_time";
  status: "active" | "revoked";
  grantedAt: string;
}

/** Every grant (active AND revoked) for the account, newest first — the Overview view's source. */
export async function readEntitlementGrants(
  tx: TenantExecutor,
  accountId: string,
): Promise<EntitlementGrantRow[]> {
  const r = await tx.query<{
    entitlement_id: string;
    source_kind: "subscription" | "one_time";
    status: "active" | "revoked";
    granted_at: unknown;
  }>(
    `SELECT entitlement_id, source_kind, status, granted_at
     FROM entitlement_grant
     WHERE account_id = $1
     ORDER BY granted_at DESC`,
    [accountId],
  );
  return r.rows.map((row) => ({
    entitlementId: row.entitlement_id,
    sourceKind: row.source_kind,
    status: row.status,
    grantedAt: toIsoString(row.granted_at),
  }));
}

export interface LicenseGrantRow {
  major: number;
  licenseId: string;
  tier: string;
  expiry: string | null;
  token: string;
  issuedAt: string;
}

/** The buyer's issued license grants (mirrors `license-grant-store.ts`'s row shape), newest major first. */
export async function readLicenseGrantRows(
  tx: TenantExecutor,
  accountId: string,
): Promise<LicenseGrantRow[]> {
  const r = await tx.query<{
    major: number;
    license_id: string;
    tier: string;
    expiry: unknown;
    token: string;
    issued_at: unknown;
  }>(
    `SELECT major, license_id, tier, expiry, token, issued_at
     FROM license_grant
     WHERE account_id = $1
     ORDER BY major DESC`,
    [accountId],
  );
  return r.rows.map((row) => ({
    major: row.major,
    licenseId: row.license_id,
    tier: row.tier,
    expiry: toIsoStringOrNull(row.expiry),
    token: row.token,
    issuedAt: toIsoString(row.issued_at),
  }));
}

export interface UsageEventRow {
  id: string;
  callId: string;
  lane: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  credits: number;
  createdAt: string;
}

/**
 * Metered AI calls from `@caisson/ai-meter`'s `usage_event` (a base-package table, not a
 * services/license one — still a cross-package coupling, just a lighter one since `@caisson/
 * ai-meter` is an ordinary composable dependency rather than a separately deployed service).
 * Returns `null` when the table does not exist yet in this environment (no metered-AI migration
 * applied) so the Activity view can fall back to the credit-ledger debit history instead of
 * surfacing a raw SQL error to a buyer.
 */
export async function readUsageEvents(
  tx: TenantExecutor,
  accountId: string,
  limit = 50,
): Promise<UsageEventRow[] | null> {
  try {
    const r = await tx.query<{
      id: string;
      call_id: string;
      lane: string;
      provider: string;
      model: string;
      input_tokens: number;
      output_tokens: number;
      credits: number;
      created_at: unknown;
    }>(
      `SELECT id, call_id, lane, provider, model, input_tokens, output_tokens, credits, created_at
       FROM usage_event
       WHERE account_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [accountId, limit],
    );
    return r.rows.map((row) => ({
      id: row.id,
      callId: row.call_id,
      lane: row.lane,
      provider: row.provider,
      model: row.model,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      credits: row.credits,
      createdAt: toIsoString(row.created_at),
    }));
  } catch {
    // `usage_event` not provisioned in this environment — not present is a valid state (the
    // table belongs to an edition-gated metering path), not a failure to surface.
    return null;
  }
}

/** Credit balance + full ledger (re-exports the existing typed `@caisson/credits` reads — no
 * raw SQL needed here, `credit_wallet`/`credit_event` are a base package the app already depends
 * on directly, not a flagged cross-service coupling). */
export async function readCreditsSummary(
  tx: TenantExecutor,
  accountId: string,
): Promise<{
  balance: number;
  ledger: Awaited<ReturnType<typeof getLedger>>;
}> {
  const [bal, ledger] = await Promise.all([
    balance(tx, accountId),
    getLedger(tx, accountId),
  ]);
  return { balance: bal, ledger };
}

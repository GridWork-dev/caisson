// Dashboard tenant reads (ADR-0114 scope item 6). Every function here runs inside `readScoped`
// (lib/db.ts -> withTenant, ADR-0005 fail-closed RLS) and returns plain data the `/dashboard`
// views render through the `@caisson/ui` kit — no mock data.
//
// CROSS-SERVICE READS EXTRACTED (Seam 1): `readEntitlementGrants` / `readLicenseGrantRows` (and their
// row types `EntitlementGrantRow` / `LicenseGrantRow`) query `entitlement_grant` / `license_grant` —
// tables OWNED by `services/license` (`@caisson/service-license`). They used to be hand-copied raw SQL
// here, so a column rename in either schema silently desynced this file with no compiler signal. They
// now live in `@caisson/platform-reads`, whose columns-contract test parses the shared DDL and fails
// on a rename. This file re-exports them so the `/dashboard` views keep importing from one place
// (`@/lib/dashboard-reads`), but the raw SQL — and the coupling risk — is gone from apps/site.
//
// `readUsageEvents` + `readCreditsSummary` stay here: they read BASE-package tables (`@caisson/ai-meter`'s
// `usage_event`, `@caisson/credits`' `credit_wallet`/`credit_event`) — ordinary composable dependencies,
// not the separately-deployed services/license tables — so they are not the flagged cross-service coupling.
import { balance, getLedger } from "@caisson/credits";
import {
  readEntitlementGrants,
  readLicenseGrantRows,
} from "@caisson/platform-reads";
import type {
  EntitlementGrantRow,
  LicenseGrantRow,
} from "@caisson/platform-reads";
import type { TenantExecutor } from "@caisson/tenancy-rls";

// Re-export the extracted cross-service reads so `/dashboard` views keep a stable import surface
// (`@/lib/dashboard-reads`). The queries + row types now live in `@caisson/platform-reads`.
export { readEntitlementGrants, readLicenseGrantRows };
export type { EntitlementGrantRow, LicenseGrantRow };

/** `timestamptz` columns come back as a driver-native `Date` instance on both PGlite and
 * node-postgres, never a string — normalize explicitly at every raw-SQL read boundary in this
 * file rather than trust the declared row type (mirrors the fix in `@caisson/credits#getLedger`). */
function toIsoString(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
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

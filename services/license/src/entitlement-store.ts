// The account-entitlement store (ADR-0071/0009). Persists WHAT an account purchased — the PURCHASED
// IDS (edition names like `compliance`, the bundle sentinel `bundle`, or à-la-carte module ids
// `@caisson/<slug>`), NEVER the expanded member-slug leaf set. The registry index expands a purchased
// id into its member slugs at gate time (`expandEntitlements`, ADR-0071), so a module added to an
// edition reaches existing buyers with no store rewrite. The credit ledger (@caisson/credits) is
// append-only / no-clawback; entitlements are MUTABLE current-truth (revocable on cancel — a follow-on
// slice once subscription→entitlement provenance is modeled), so this is a state table, not a ledger.
//
// Tenant-owned + fail-closed RLS via @caisson/tenancy-rls (ADR-0005): every read/write runs inside
// `withTenant`, scoped to the buyer's account; the policy WITH CHECK rejects an insert whose
// account_id ≠ the bound GUC, and a read that forgets its WHERE still sees only the caller's rows.
import { randomUUID } from "node:crypto";
import type { TenantExecutor } from "@caisson/tenancy-rls";
import { buildTenantPolicySql } from "@caisson/tenancy-rls";

// One row per (account, purchased id). The UNIQUE (account_id, entitlement_id) constraint
// (`account_entitlement_uniq`) is the idempotency anchor that `ON CONFLICT (account_id, entitlement_id)
// DO NOTHING` targets; `id` is just a surrogate row key (a fresh randomUUID, never collides).
// Re-granting the same entitlement (a webhook retry, a renewal cycle) is a no-op. `source_event_id`
// records the billing event that first granted it (audit / future revoke correlation), it is NOT part
// of the uniqueness — two events granting the same edition collapse to one entitlement row.
export const ENTITLEMENT_SCHEMA_SQL = `
CREATE TABLE account_entitlement (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  entitlement_id text NOT NULL,
  source_event_id text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_entitlement_uniq UNIQUE (account_id, entitlement_id)
);

${buildTenantPolicySql("account_entitlement")}
`;

export interface GrantEntitlementsInput {
  /** The buyer account — MUST equal the `withTenant` scope (the RLS WITH CHECK enforces it). */
  accountId: string;
  /** Purchased ids to grant (editions/bundle/modules). An empty array is a no-op. */
  entitlementIds: readonly string[];
  /** Provenance: the billing/purchase event id that granted these (audit). */
  sourceEventId: string;
}

/**
 * Grant a set of purchased-id entitlements to an account, idempotently. Each id is upserted ON
 * CONFLICT DO NOTHING on `(account_id, entitlement_id)`, so a webhook retry or a renewal cycle
 * re-granting the same edition is absorbed without a duplicate row and without poisoning the
 * surrounding transaction (a caught 23505 would). Must run inside `withTenant(pg, accountId, …)`.
 * Returns the number of entitlements NEWLY granted (0 on a full replay).
 */
export async function grantEntitlements(
  tx: TenantExecutor,
  input: GrantEntitlementsInput,
): Promise<number> {
  let granted = 0;
  for (const entitlementId of input.entitlementIds) {
    const inserted = await tx.query<{ id: string }>(
      `INSERT INTO account_entitlement (id, account_id, entitlement_id, source_event_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (account_id, entitlement_id) DO NOTHING
       RETURNING id`,
      [randomUUID(), input.accountId, entitlementId, input.sourceEventId],
    );
    if (inserted.rows.length > 0) granted += 1;
  }
  return granted;
}

/**
 * Read an account's purchased-id entitlements (the raw ids, NOT expanded). RLS scopes the result to
 * the bound account; the explicit `account_id` predicate is belt-and-suspenders over that gate.
 * Sorted for a deterministic, stable result. Run inside `withTenant`.
 */
export async function readEntitlements(
  tx: TenantExecutor,
  accountId: string,
): Promise<string[]> {
  const r = await tx.query<{ entitlement_id: string }>(
    `SELECT entitlement_id FROM account_entitlement
     WHERE account_id = $1
     ORDER BY entitlement_id`,
    [accountId],
  );
  return r.rows.map((row) => row.entitlement_id);
}

// The reference-counted entitlement-GRANT store (ADR-0109, evolving ADR-0071/0009). Replaces the flat
// `account_entitlement` state table with a JUNCTION: one ROW per (account, entitlement, source) grant.
// An account HAS an entitlement iff it holds >=1 ACTIVE grant for it — so two sources granting the same
// edition (a subscription AND a one-time buy) survive the loss of either alone (refcount), and a
// soft-revoke of one source never strips an entitlement another source still backs. Grants are NEVER
// hard-deleted (audit trail): a revoke flips `status='revoked'` + stamps `revoked_at`.
//
// Each grant records its SOURCE: `source_kind` in {subscription, one_time}. A subscription grant carries
// `subscription_id` (purchase_id NULL); a one-time grant carries `purchase_id` — the PaymentIntent id —
// (subscription_id NULL). The single ACTIVE-refcount truth still stores PURCHASED IDS (editions/bundle/
// modules), never the expanded member-slug leaf set — the registry index expands at gate time
// (`expandEntitlements`, resolve-entitlements.ts), so a module added to an edition reaches existing
// buyers with no store rewrite.
//
// Tenant-owned + fail-closed RLS via @caisson/tenancy-rls (ADR-0005): every read/write/revoke runs
// inside `withTenant`, scoped to the buyer's account; the policy WITH CHECK rejects a cross-tenant
// write, and a read that forgets its WHERE still sees only the caller's rows.
import { randomUUID } from "node:crypto";
import type { TenantExecutor } from "@caisson/tenancy-rls";
import { buildTenantPolicySql } from "@caisson/tenancy-rls";

// One row per grant. The idempotency anchor is the expression-unique index
// `entitlement_grant_uniq (account_id, entitlement_id, source_kind, COALESCE(subscription_id,
// purchase_id))`: a subscription RENEWAL re-confirming the same edition for the same subscription, or a
// one-time webhook retry on the same payment, collapses to the existing row (ON CONFLICT DO NOTHING) —
// refcount stays one-per-source, so a later revoke of that source clears exactly its single grant. The
// CHECKs pin the source shape (a subscription grant has a subscription_id and no purchase_id, and vice
// versa) and the revoke biconditional (revoked iff revoked_at is set).
export const ENTITLEMENT_SCHEMA_SQL = `
CREATE TABLE entitlement_grant (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  entitlement_id text NOT NULL,
  source_kind text NOT NULL,
  subscription_id text,
  purchase_id text,
  source_event_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT entitlement_grant_source_kind CHECK (source_kind IN ('subscription', 'one_time')),
  CONSTRAINT entitlement_grant_status CHECK (status IN ('active', 'revoked')),
  CONSTRAINT entitlement_grant_source_ref CHECK (
    (source_kind = 'subscription' AND subscription_id IS NOT NULL AND purchase_id IS NULL)
    OR (source_kind = 'one_time' AND purchase_id IS NOT NULL AND subscription_id IS NULL)
  ),
  CONSTRAINT entitlement_grant_revoked_iff CHECK (
    (status = 'revoked') = (revoked_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX entitlement_grant_uniq
  ON entitlement_grant (account_id, entitlement_id, source_kind, COALESCE(subscription_id, purchase_id));

${buildTenantPolicySql("entitlement_grant")}
`;

// Forward migration from the prior flat `account_entitlement` shape (ADR-0071) → the junction
// (ADR-0109), for the prod numbered-Drizzle path (ADR-0014). PRE-LAUNCH there is no live data
// (checkout is not yet live, ADR-0082/0106), so the new schema supersedes the old cleanly; this snippet
// is the belt-and-suspenders backfill for any environment that DID create the old table. Each legacy
// row becomes an ACTIVE one_time grant keyed on its source event id (the safe default — legacy grants
// carry no subscription provenance, so they must NOT be swept by a subscription cancel). Idempotent +
// guarded by table existence; runs in PL/pgSQL (not exercised by the unit-test DDL, which builds the
// junction fresh).
export const ENTITLEMENT_GRANT_MIGRATION_SQL = `
DO $$
BEGIN
  IF to_regclass('account_entitlement') IS NOT NULL THEN
    INSERT INTO entitlement_grant
      (id, account_id, entitlement_id, source_kind, purchase_id, source_event_id, status, granted_at)
    SELECT id, account_id, entitlement_id, 'one_time',
           COALESCE(source_event_id, id), COALESCE(source_event_id, id), 'active', granted_at
    FROM account_entitlement
    ON CONFLICT DO NOTHING;
    DROP TABLE account_entitlement;
  END IF;
END $$;
`;

/** The provenance of a grant: a recurring subscription, or a one-time (non-subscription) purchase. */
export type GrantSource =
  | { kind: "subscription"; subscriptionId: string }
  | { kind: "one_time"; purchaseId: string };

export interface GrantEntitlementsInput {
  /** The buyer account — MUST equal the `withTenant` scope (the RLS WITH CHECK enforces it). */
  accountId: string;
  /** Purchased ids to grant (editions/bundle/modules). An empty array is a no-op. */
  entitlementIds: readonly string[];
  /** Provenance: the billing/purchase event id that granted these (audit). */
  sourceEventId: string;
  /** WHICH source backs this grant — the refcount key + the revoke filter. */
  source: GrantSource;
}

function sourceColumns(source: GrantSource): {
  kind: GrantSource["kind"];
  subscriptionId: string | null;
  purchaseId: string | null;
} {
  return source.kind === "subscription"
    ? {
        kind: "subscription",
        subscriptionId: source.subscriptionId,
        purchaseId: null,
      }
    : { kind: "one_time", subscriptionId: null, purchaseId: source.purchaseId };
}

/**
 * Grant a set of purchased-id entitlements to an account from one source, idempotently. Each id is
 * upserted ON CONFLICT DO NOTHING on the per-source uniqueness, so a webhook retry or a subscription
 * renewal re-granting the same edition from the same source is absorbed without a duplicate row and
 * without poisoning the surrounding transaction (a caught 23505 would). Must run inside
 * `withTenant(pg, accountId, …)`. Returns the number of grants NEWLY created (0 on a full replay).
 */
export async function grantEntitlements(
  tx: TenantExecutor,
  input: GrantEntitlementsInput,
): Promise<number> {
  const cols = sourceColumns(input.source);
  let granted = 0;
  for (const entitlementId of input.entitlementIds) {
    const inserted = await tx.query<{ id: string }>(
      `INSERT INTO entitlement_grant
         (id, account_id, entitlement_id, source_kind, subscription_id, purchase_id, source_event_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (account_id, entitlement_id, source_kind, COALESCE(subscription_id, purchase_id))
       DO NOTHING
       RETURNING id`,
      [
        randomUUID(),
        input.accountId,
        entitlementId,
        cols.kind,
        cols.subscriptionId,
        cols.purchaseId,
        input.sourceEventId,
      ],
    );
    if (inserted.rows.length > 0) granted += 1;
  }
  return granted;
}

/**
 * Read an account's ACTIVE purchased-id entitlements (the raw ids, NOT expanded), distinct across
 * sources — an account holding the same edition from two sources still reads it once. A fully-revoked
 * entitlement (refcount 0) drops out. RLS scopes the result to the bound account; the explicit
 * `account_id` predicate is belt-and-suspenders over that gate. Sorted for a stable result. Run inside
 * `withTenant`.
 */
export async function readEntitlements(
  tx: TenantExecutor,
  accountId: string,
): Promise<string[]> {
  const r = await tx.query<{ entitlement_id: string }>(
    `SELECT DISTINCT entitlement_id FROM entitlement_grant
     WHERE account_id = $1 AND status = 'active'
     ORDER BY entitlement_id`,
    [accountId],
  );
  return r.rows.map((row) => row.entitlement_id);
}

export interface RevokeSubscriptionInput {
  accountId: string;
  subscriptionId: string;
}

/**
 * Soft-revoke (status='revoked' + revoked_at=now) every ACTIVE grant backed by a given subscription —
 * and ONLY that subscription (never another's, never a one-time grant). The entitlement is lost only
 * when its refcount hits 0, so an entitlement also backed by an active one-time grant survives. Already-
 * revoked grants are skipped (status='active' filter) → idempotent. Returns the number revoked. Run
 * inside `withTenant`.
 */
export async function revokeSubscriptionGrants(
  tx: TenantExecutor,
  input: RevokeSubscriptionInput,
): Promise<number> {
  const r = await tx.query<{ id: string }>(
    `UPDATE entitlement_grant
       SET status = 'revoked', revoked_at = now()
     WHERE account_id = $1
       AND source_kind = 'subscription'
       AND subscription_id = $2
       AND status = 'active'
     RETURNING id`,
    [input.accountId, input.subscriptionId],
  );
  return r.rows.length;
}

export interface RevokePurchaseInput {
  accountId: string;
  purchaseId: string;
}

/**
 * Soft-revoke every ACTIVE grant backed by a given one-time purchase (the PaymentIntent id) — the
 * refund path. Already-revoked grants are skipped → idempotent (a re-delivered refund revokes nothing
 * the second time, the latch the refund handler keys its clawback on). Returns the number revoked. Run
 * inside `withTenant`.
 */
export async function revokePurchaseGrants(
  tx: TenantExecutor,
  input: RevokePurchaseInput,
): Promise<number> {
  const r = await tx.query<{ id: string }>(
    `UPDATE entitlement_grant
       SET status = 'revoked', revoked_at = now()
     WHERE account_id = $1
       AND source_kind = 'one_time'
       AND purchase_id = $2
       AND status = 'active'
     RETURNING id`,
    [input.accountId, input.purchaseId],
  );
  return r.rows.length;
}

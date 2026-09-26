// src/idempotency.ts — dual-layer billing-webhook idempotency (ADR-0229 rows 50 + 51, ADR-0006).
//
// The credit ledger is ALREADY idempotent (ADR-0007/0024: `credit_event`'s UNIQUE (source_event_id,
// event_type) index + `ON CONFLICT DO NOTHING` + `FOR UPDATE` clawback) — a re-delivered webhook can
// never double-grant credits. That is the INNER layer. What it can't cover is a NON-DB side-effect
// that fires OUTSIDE the ledger write: a post-commit notification push (fired detached by the host)
// re-fires on every provider re-delivery, and an email receipt would too.
//
// This adds the OUTER + PER-SIDE-EFFECT layers, both over one tiny claim table:
//   - processEvent(tx, sourceEventId, fn): claim the whole event once. A fresh delivery runs `fn`
//     (the grant) and reports {alreadyProcessed:false}; a re-delivery finds the claim, SKIPS `fn`, and
//     reports {alreadyProcessed:true} — so the caller returns no granted entitlements and the
//     post-commit push is gated out.
//   - withIdempotentSideEffect(tx, sourceEventId, sideEffect, fn): claim ONE named effect of an event,
//     so an event fanning into N transactional writes fires each at most once across re-deliveries.
//
// Both run INSIDE the caller's `withTenant` tx, so the claim commits atomically with the grant `fn`
// performs: if `fn` throws, the whole tx (claim included) rolls back and the next delivery retries
// cleanly — the claim only persists once the work it guards has durably committed.
import {
  TENANT_GUC,
  buildTenantPolicySql,
  type TenantExecutor,
} from "@caisson-sh/tenancy-rls";
import { assertValidSourceEventId, sideEffectEventKey } from "./event-keys.ts";

/**
 * The outer webhook-event dedup table (ADR-0006 append-only). Ships as a checksum-pinned platform
 * migration STRING (a new file in apps/site deploy-migrate), never an edit to an existing one — see
 * `CREDIT_ROUNDING_MIGRATION_SQL`'s convention. Tenant-owned (the claim runs inside `withTenant`): the
 * row's `account_id` is bound from the tenant GUC on insert, so the FORCE-RLS policy admits only the
 * tenant's own claims. `event_key` is the PK — `sourceEventId` for the outer layer, `${sourceEventId}:
 * ${sideEffect}` for the per-effect layer — both share this one table + mechanic.
 */
export const PROCESSED_EVENT_SCHEMA_SQL = `
CREATE TABLE billing_processed_event (
  event_key text PRIMARY KEY,
  account_id text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  -- Fail-closed: an unset tenant GUC resolves to '' (not NULL — a known placeholder GUC), so a claim
  -- attempted OUTSIDE withTenant would otherwise land under a shared blank tenant. Refuse it at the DB.
  CONSTRAINT billing_processed_event_account_not_blank CHECK (account_id <> '')
);
${buildTenantPolicySql("billing_processed_event")}
`;

export interface ProcessResult {
  /** True when this event was already claimed by a prior delivery — `fn` was NOT run this call. */
  alreadyProcessed: boolean;
}

/**
 * Atomically claim `eventKey`: INSERT ... ON CONFLICT DO NOTHING RETURNING. `account_id` is bound from
 * the tenant GUC (`current_setting`, `missing_ok=true`) so a claim ATTEMPTED outside `withTenant` gets
 * a blank account_id (a known placeholder GUC resolves to '' when unset, not NULL) and fails the
 * non-blank CHECK — fail-closed, never an unscoped claim. Returns true iff this call inserted the row
 * (a fresh claim); false when the key already existed.
 *
 * A cross-tenant `event_key` collision (a provider id genuinely reused across two tenants — impossible
 * for globally-unique Paddle/Stripe ids) fails SAFE: the PK conflict makes the second tenant's claim
 * a no-op (skip), never a double-process.
 */
async function claim(tx: TenantExecutor, eventKey: string): Promise<boolean> {
  const { rows } = await tx.query<{ event_key: string }>(
    `INSERT INTO billing_processed_event (event_key, account_id)
       VALUES ($1, current_setting($2, true))
     ON CONFLICT (event_key) DO NOTHING
     RETURNING event_key`,
    [eventKey, TENANT_GUC],
  );
  return rows.length === 1;
}

/**
 * OUTER layer: run `fn` for `sourceEventId` exactly once across re-deliveries. A fresh claim runs `fn`
 * and returns `{alreadyProcessed:false}`; a re-delivery skips `fn` and returns `{alreadyProcessed:
 * true}`. Call inside the caller's `withTenant` tx so the claim + the grant `fn` performs commit (or
 * roll back) together.
 */
export async function processEvent(
  tx: TenantExecutor,
  sourceEventId: string,
  fn: () => Promise<void>,
): Promise<ProcessResult> {
  // A blank claim key would collapse every unattributed event onto one row; a ':' would risk
  // aliasing a per-effect composite key — both fail closed.
  assertValidSourceEventId(sourceEventId, "processEvent");
  const fresh = await claim(tx, sourceEventId);
  if (!fresh) return { alreadyProcessed: true };
  await fn();
  return { alreadyProcessed: false };
}

/**
 * PER-SIDE-EFFECT layer: run `fn` for `${sourceEventId}:${sideEffect}` exactly once — one event fanning
 * into N transactional side-effects fires each at most once across re-deliveries. Returns whether THIS
 * call performed the effect (`false` ⇒ already done, skipped). Same table + mechanic as
 * {@link processEvent}; run inside `withTenant`. (For a DETACHED post-commit effect that cannot join
 * the tx — e.g. the Discord push — gate on the outer {@link processEvent} claim instead.)
 */
export async function withIdempotentSideEffect(
  tx: TenantExecutor,
  sourceEventId: string,
  sideEffect: string,
  fn: () => Promise<void>,
): Promise<boolean> {
  // Guards + composition live in event-keys.ts (the pure half), so the key shape this table's
  // namespace depends on has exactly one implementation.
  const fresh = await claim(tx, sideEffectEventKey(sourceEventId, sideEffect));
  if (!fresh) return false;
  await fn();
  return true;
}

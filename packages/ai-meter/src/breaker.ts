// The spend circuit breaker (ADR-0060). A per-`(account, scope)` stored state that `reserve()`
// reads BEFORE every reservation: an `open` breaker returns 402 and the provider is never called.
// A hard spend cap trips it (`tripBreaker`); it stays open until an operator path resets it
// (`resetBreaker`) — fail-closed, so a runaway loop cannot keep spending past the cap. All ops run
// inside `withTenant`, so RLS scopes every read/write to the calling tenant (ADR-0005).
// The scope constant, the state vocabulary and `SpendCapError` moved to ./contracts.ts (ADR-0396) so
// the browser entry can reach them without this file's store edges; the names are unchanged.
import type { TenantExecutor } from "@caisson-sh/tenancy-rls";
import { SpendCapError } from "./contracts.ts";
import type { BreakerState, BreakerStatus } from "./contracts.ts";
import { SPEND_BREAKER_TABLE } from "./schema.ts";

/** Read the breaker; a `(account, scope)` with no row is closed by default. */
export async function readBreaker(
  tx: TenantExecutor,
  accountId: string,
  scope: string,
): Promise<BreakerStatus> {
  const r = await tx.query<{ state: BreakerState; reason: string | null }>(
    `SELECT state, reason FROM ${SPEND_BREAKER_TABLE}
       WHERE account_id = $1 AND scope = $2`,
    [accountId, scope],
  );
  const row = r.rows[0];
  if (row === undefined) return { state: "closed", reason: null };
  return { state: row.state, reason: row.reason };
}

/** Throw `SpendCapError` (402) when the breaker is open — the pre-reserve gate. */
export async function assertBreakerClosed(
  tx: TenantExecutor,
  accountId: string,
  scope: string,
): Promise<void> {
  const status = await readBreaker(tx, accountId, scope);
  if (status.state === "open") throw new SpendCapError(scope);
}

/** Trip the breaker open (idempotent upsert). `tripped_at` moves with `state` per the schema CHECK. */
export async function tripBreaker(
  tx: TenantExecutor,
  accountId: string,
  scope: string,
  reason: string,
): Promise<void> {
  await tx.query(
    `INSERT INTO ${SPEND_BREAKER_TABLE} (account_id, scope, state, reason, tripped_at)
       VALUES ($1, $2, 'open', $3, now())
     ON CONFLICT (account_id, scope)
       DO UPDATE SET state = 'open', reason = EXCLUDED.reason,
                     tripped_at = now(), updated_at = now()`,
    [accountId, scope, reason],
  );
}

/** Reset the breaker closed (operator path). Clears `tripped_at` to satisfy the open-iff-tripped CHECK. */
export async function resetBreaker(
  tx: TenantExecutor,
  accountId: string,
  scope: string,
): Promise<void> {
  await tx.query(
    `INSERT INTO ${SPEND_BREAKER_TABLE} (account_id, scope, state, reason, tripped_at)
       VALUES ($1, $2, 'closed', NULL, NULL)
     ON CONFLICT (account_id, scope)
       DO UPDATE SET state = 'closed', reason = NULL,
                     tripped_at = NULL, updated_at = now()`,
    [accountId, scope],
  );
}

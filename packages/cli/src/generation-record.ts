// The generation audit row (ADR-0049/0024/0005). Every successful, debited generation records
// ONE append-only `generation` row INSIDE the same `withTenant` transaction as the debit (POST-debit):
// the credit ledger answers "was this charged"; this table answers "what was materialized, for whom".
// Mirrors the credits pattern exactly — fail-closed RLS scoped to `account_id`, `ON CONFLICT DO
// NOTHING` so a same-`idempotencyKey` retry records once (never a second row). The row is a snapshot:
// the validated `selection` (jsonb) + a sha-256 over the deterministic materialized file set.
import { createHash, randomUUID } from "node:crypto";
import { buildTenantPolicySql } from "@caisson/tenancy-rls";
import type { TenantExecutor } from "@caisson/tenancy-rls";
import type { GeneratedFileSet, Selection } from "./generate.ts";

// Append-only generation audit table (ADR-0006). `id` is a uuid string PK (mirrors credit_event's
// text PK + randomUUID()). One row per (account, idempotency key): the UNIQUE index makes a same-key
// retry an ON CONFLICT no-op rather than a duplicate. RLS via @caisson/tenancy-rls — tenant-owned,
// fail-closed (a query without the bound GUC sees nothing). In prod this is a numbered Drizzle
// migration (ADR-0014); the DDL is owned here, exactly as CREDIT_SCHEMA_SQL is owned by credits.
export const GENERATION_SCHEMA_SQL = `
CREATE TABLE generation (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  idempotency_key text NOT NULL,
  -- A snapshot of the validated buyer Selection (project + edition + module pins).
  selection jsonb NOT NULL,
  -- sha-256 (hex) over the deterministic materialized file set — "what bytes were emitted".
  file_set_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One generation per (account, idempotency key): a same-key retry records once (ADR-0024).
CREATE UNIQUE INDEX generation_account_idem_uniq
  ON generation (account_id, idempotency_key);

${buildTenantPolicySql("generation")}
`;

/**
 * A deterministic sha-256 (hex) over a generated file set. Path + content sensitive and order
 * independent (the set is path-sorted before hashing), so a re-materialized identical selection
 * hashes identically while any path/content drift changes the digest. The recorded `file_set_hash`.
 */
export function hashFileSet(files: GeneratedFileSet): string {
  const h = createHash("sha256");
  for (const f of [...files].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  )) {
    // NUL-delimited so (path, content) boundaries can't be forged by content that contains a path.
    h.update(f.path);
    h.update("\0");
    h.update(f.content);
    h.update("\0");
  }
  return h.digest("hex");
}

/** The audit snapshot for one generation. `idempotencyKey` is the caller-minted per-generation UUID. */
export interface RecordGenerationInput {
  accountId: string;
  idempotencyKey: string;
  /** The validated buyer selection (snapshotted as jsonb). */
  selection: Selection;
  /** sha-256 (hex) of the materialized file set — compute via `hashFileSet`. */
  fileSetHash: string;
}

export interface GenerationRecordResult {
  /** True on the first record for this key; false when an existing row absorbed the retry (no-op). */
  recorded: boolean;
  /**
   * The canonical generation row id: the new row's id on first insert, or the existing row's id on a
   * same-key retry (ADR-0024). Stable across retries so the caller gets a consistent reference without
   * a second round-trip.
   */
  id: string;
}

/**
 * Record one generation audit row, POST-debit, inside the SAME `withTenant` transaction as the debit.
 * Idempotent on `(account_id, idempotency_key)`: `ON CONFLICT DO NOTHING` so a retried generation
 * with the same key records once — the conflict is absorbed without poisoning the surrounding
 * transaction (a raised 23505 would). RLS `WITH CHECK` ties the row to the bound tenant: an
 * `accountId` that does not match the active GUC is refused outright (fail-closed).
 *
 * Returns the canonical row id in BOTH cases: the new row's id on a fresh insert, or the existing
 * row's id when the conflict fires. The SELECT on a retry is RLS-scoped to the same `accountId` that
 * the surrounding `withTenant` bound as the GUC — the policy USING clause is satisfied.
 */
export async function recordGeneration(
  tx: TenantExecutor,
  input: RecordGenerationInput,
): Promise<GenerationRecordResult> {
  const inserted = await tx.query<{ id: string }>(
    `INSERT INTO generation (id, account_id, idempotency_key, selection, file_set_hash)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (account_id, idempotency_key) DO NOTHING
     RETURNING id`,
    [
      randomUUID(),
      input.accountId,
      input.idempotencyKey,
      JSON.stringify(input.selection),
      input.fileSetHash,
    ],
  );
  if (inserted.rows.length > 0) {
    // Fresh insert: the RETURNING clause gives the new row's id.
    return { recorded: true, id: inserted.rows[0]!.id };
  }
  // ON CONFLICT DO NOTHING: the row already exists. SELECT it within the same tenant-scoped
  // transaction — the RLS USING clause (account_id = current_setting('app.current_account')) is
  // satisfied because withTenant bound the GUC to input.accountId before the INSERT, and we're
  // still inside that same transaction.
  const existing = await tx.query<{ id: string }>(
    `SELECT id FROM generation WHERE account_id = $1 AND idempotency_key = $2`,
    [input.accountId, input.idempotencyKey],
  );
  const id = existing.rows[0]?.id;
  if (id === undefined) {
    // Should be unreachable: ON CONFLICT fired so the row must exist; SELECT with matching RLS
    // must return it. A missing row here indicates a schema or RLS misconfiguration — surface loudly.
    throw new Error(
      `generation row unexpectedly absent after ON CONFLICT for account ${input.accountId} / key ${input.idempotencyKey}`,
    );
  }
  return { recorded: false, id };
}

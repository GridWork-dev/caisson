// Credit wallet operations (ADR-0007/0023). Integer-only. Debit-before-spend: the debit is
// recorded and the balance decremented atomically BEFORE the caller does the paid work; an empty
// or short balance throws 402 and nothing is recorded. Idempotency uses `ON CONFLICT DO NOTHING
// RETURNING` so a retried grant/debit is absorbed WITHOUT aborting the surrounding transaction
// (a caught 23505 would poison it). Run inside `withTenant` so RLS scopes the ledger.
import { randomUUID } from "node:crypto";
import { InsufficientCreditsError, ValidationError } from "@stack/kernel";
import type { TenantExecutor } from "@stack/tenancy-rls";

export const GRANT_EVENT_TYPES = [
  "purchase",
  "sub_allotment",
  "topup",
] as const;
export const DEBIT_EVENT_TYPES = ["codegen_debit", "ai_feature_debit"] as const;
export type GrantEventType = (typeof GRANT_EVENT_TYPES)[number];
export type DebitEventType = (typeof DEBIT_EVENT_TYPES)[number];

interface IdempotencySource {
  /** A provider event id (Stripe etc). Mutually exclusive with `idempotencyKey`. */
  sourceEventId?: string;
  /** A caller-supplied per-account key. Mutually exclusive with `sourceEventId`. */
  idempotencyKey?: string;
}

export interface GrantInput extends IdempotencySource {
  accountId: string;
  amount: number;
  eventType: GrantEventType;
}

export interface DebitInput extends IdempotencySource {
  accountId: string;
  amount: number;
  eventType: DebitEventType;
}

export interface CreditResult {
  balance: number;
  /** True when this call was a no-op replay of an already-applied event. */
  idempotent: boolean;
}

function assertPositiveInt(amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new ValidationError("amount must be a positive integer", {
      field: "amount",
    });
  }
}

function idemColumns({ sourceEventId, idempotencyKey }: IdempotencySource): {
  sourceEventId: string | null;
  idempotencyKey: string | null;
} {
  const hasSource = sourceEventId !== undefined;
  const hasKey = idempotencyKey !== undefined;
  if (hasSource === hasKey) {
    throw new ValidationError(
      "provide exactly one of sourceEventId / idempotencyKey",
      {
        field: "idempotency",
      },
    );
  }
  return {
    sourceEventId: sourceEventId ?? null,
    idempotencyKey: idempotencyKey ?? null,
  };
}

export async function balance(
  tx: TenantExecutor,
  accountId: string,
): Promise<number> {
  const r = await tx.query<{ balance: number }>(
    `SELECT balance FROM credit_wallet WHERE account_id = $1`,
    [accountId],
  );
  return r.rows[0]?.balance ?? 0;
}

async function insertEvent(
  tx: TenantExecutor,
  row: {
    accountId: string;
    eventType: string;
    amount: number;
    sourceEventId: string | null;
    idempotencyKey: string | null;
  },
): Promise<boolean> {
  // ON CONFLICT DO NOTHING: a duplicate idempotency key returns zero rows instead of raising —
  // the transaction stays usable.
  const inserted = await tx.query<{ id: string }>(
    `INSERT INTO credit_event (id, account_id, event_type, amount, source_event_id, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      randomUUID(),
      row.accountId,
      row.eventType,
      row.amount,
      row.sourceEventId,
      row.idempotencyKey,
    ],
  );
  return inserted.rows.length > 0;
}

/** Grant credits (purchase / subscription allotment / top-up). Idempotent; never double-grants. */
export async function grant(
  tx: TenantExecutor,
  input: GrantInput,
): Promise<CreditResult> {
  assertPositiveInt(input.amount);
  const idem = idemColumns(input);
  const fresh = await insertEvent(tx, {
    accountId: input.accountId,
    eventType: input.eventType,
    amount: input.amount,
    ...idem,
  });
  if (!fresh)
    return { balance: await balance(tx, input.accountId), idempotent: true };

  const r = await tx.query<{ balance: number }>(
    `INSERT INTO credit_wallet (account_id, balance) VALUES ($1, $2)
     ON CONFLICT (account_id) DO UPDATE SET balance = credit_wallet.balance + $2
     RETURNING balance`,
    [input.accountId, input.amount],
  );
  return { balance: r.rows[0]?.balance ?? input.amount, idempotent: false };
}

/**
 * Debit credits before the paid work. Atomic floor: the balance only decrements when it can
 * cover the amount, else 402 and the whole transaction rolls back (no debit recorded).
 * Idempotent on the supplied key/source.
 */
export async function debit(
  tx: TenantExecutor,
  input: DebitInput,
): Promise<CreditResult> {
  assertPositiveInt(input.amount);
  const idem = idemColumns(input);
  const fresh = await insertEvent(tx, {
    accountId: input.accountId,
    eventType: input.eventType,
    amount: -input.amount,
    ...idem,
  });
  if (!fresh)
    return { balance: await balance(tx, input.accountId), idempotent: true };

  const updated = await tx.query<{ balance: number }>(
    `UPDATE credit_wallet SET balance = balance - $2
     WHERE account_id = $1 AND balance >= $2
     RETURNING balance`,
    [input.accountId, input.amount],
  );
  if (updated.rows.length === 0) {
    // Insufficient: throwing rolls back the surrounding withTenant transaction, undoing the
    // event insert above — debit-before-spend means a failed debit leaves no trace.
    throw new InsufficientCreditsError(
      input.amount,
      await balance(tx, input.accountId),
    );
  }
  return { balance: updated.rows[0]?.balance ?? 0, idempotent: false };
}

export interface LedgerEntry {
  id: string;
  event_type: string;
  amount: number;
  source_event_id: string | null;
  idempotency_key: string | null;
}

/** The append-only ledger for an account, oldest first. `sum(amount)` equals the balance. */
export async function getLedger(
  tx: TenantExecutor,
  accountId: string,
): Promise<LedgerEntry[]> {
  const r = await tx.query<LedgerEntry>(
    `SELECT id, event_type, amount, source_event_id, idempotency_key
     FROM credit_event WHERE account_id = $1 ORDER BY created_at, id`,
    [accountId],
  );
  return r.rows;
}

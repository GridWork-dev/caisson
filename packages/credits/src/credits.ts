// Credit wallet operations (ADR-0007/0023). Integer-only. Debit-before-spend: the debit is
// recorded and the balance decremented atomically BEFORE the caller does the paid work; an empty
// or short balance throws 402 and nothing is recorded. Idempotency uses `ON CONFLICT DO NOTHING
// RETURNING` so a retried grant/debit is absorbed WITHOUT aborting the surrounding transaction
// (a caught 23505 would poison it). Run inside `withTenant` so RLS scopes the ledger.
import { randomUUID } from "node:crypto";
import { InsufficientCreditsError, ValidationError } from "@caisson/kernel";
import { type FeatureTag, FeatureTagSchema } from "@caisson/registry-schema";
import type { TenantExecutor } from "@caisson/tenancy-rls";

// `feature_grant` / `feature_debit` are the generic feature-meter envelopes (ADR-0074): an edition
// meters a NEW action through these carrying a registered `feature` tag, never by extending this
// base-owned, base-closed event-type set. The legacy specifics stay immutable + are not retrofitted.
export const GRANT_EVENT_TYPES = [
  "purchase",
  "sub_allotment",
  "topup",
  "feature_grant",
] as const;
export const DEBIT_EVENT_TYPES = [
  "codegen_debit",
  "ai_feature_debit",
  "feature_debit",
  // The compensating debit a refund writes to claw back UNSPENT credits granted by the refunded
  // purchase (ADR-0113). It is NOT a spendable-balance debit (no 402 floor): the amount is bounded to
  // the current balance so the wallet never goes negative. Written only via `clawback`, never `debit`.
  "refund_clawback",
] as const;
export type GrantEventType = (typeof GRANT_EVENT_TYPES)[number];
export type DebitEventType = (typeof DEBIT_EVENT_TYPES)[number];

interface IdempotencySource {
  /** A provider event id (Stripe etc). Mutually exclusive with `idempotencyKey`. */
  sourceEventId?: string;
  /** A caller-supplied per-account key. Mutually exclusive with `sourceEventId`. */
  idempotencyKey?: string;
}

interface CreditInputBase extends IdempotencySource {
  accountId: string;
  amount: number;
}

// Discriminated on `eventType` so a `feature` tag is REQUIRED with feature_grant/feature_debit and
// FORBIDDEN (`feature?: never`) on a legacy specific type — mirroring the DB `credit_event_feature_iff`
// CHECK at compile time (a typo is a type error too). `feature` stays payload: idempotency is unchanged.
export type GrantInput =
  | (CreditInputBase & {
      eventType: "purchase" | "sub_allotment" | "topup";
      feature?: never;
    })
  | (CreditInputBase & { eventType: "feature_grant"; feature: FeatureTag });

export type DebitInput =
  | (CreditInputBase & {
      eventType: "codegen_debit" | "ai_feature_debit";
      feature?: never;
    })
  | (CreditInputBase & { eventType: "feature_debit"; feature: FeatureTag });

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

/**
 * Resolve the `feature` payload column, fail-closed (ADR-0074, threat TM-D). A feature_debit/
 * feature_grant MUST carry a tag validated against the registered set; a legacy specific type MUST
 * NOT carry one (mirrors the DB `credit_event_feature_iff` CHECK). This runs BEFORE the ledger insert
 * — an unregistered/typo tag throws with no ledger write — and is the runtime backstop to the
 * compile-time discriminated union (a non-literal caller can still reach here with a bad value).
 */
function featureColumn(
  eventType: GrantEventType | DebitEventType,
  feature: FeatureTag | undefined,
): string | null {
  const isFeatureEvent =
    eventType === "feature_debit" || eventType === "feature_grant";
  if (!isFeatureEvent) {
    if (feature !== undefined) {
      throw new ValidationError(
        "feature tag is only valid on feature_debit / feature_grant",
        { field: "feature" },
      );
    }
    return null;
  }
  if (feature === undefined) {
    throw new ValidationError(
      "feature_debit / feature_grant require a feature tag",
      { field: "feature" },
    );
  }
  // Validate against the registered set (registry seam). z.enum rejects any non-member, so a typo
  // or unregistered action fails closed here — it can never mint a silent meter.
  const parsed = FeatureTagSchema.safeParse(feature);
  if (!parsed.success) {
    throw new ValidationError(
      `unregistered feature tag: ${JSON.stringify(feature)}`,
      { field: "feature" },
    );
  }
  return parsed.data;
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
    feature: string | null;
    sourceEventId: string | null;
    idempotencyKey: string | null;
  },
): Promise<boolean> {
  // ON CONFLICT DO NOTHING: a duplicate idempotency key returns zero rows instead of raising —
  // the transaction stays usable. `feature` is payload — NOT part of either idempotency index.
  const inserted = await tx.query<{ id: string }>(
    `INSERT INTO credit_event (id, account_id, event_type, amount, feature, source_event_id, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      randomUUID(),
      row.accountId,
      row.eventType,
      row.amount,
      row.feature,
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
  const feature = featureColumn(input.eventType, input.feature);
  const fresh = await insertEvent(tx, {
    accountId: input.accountId,
    eventType: input.eventType,
    amount: input.amount,
    feature,
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
  const feature = featureColumn(input.eventType, input.feature);
  const fresh = await insertEvent(tx, {
    accountId: input.accountId,
    eventType: input.eventType,
    amount: -input.amount,
    feature,
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
  /** The registered feature tag (ADR-0074) for a feature_debit/feature_grant; null otherwise. */
  feature: string | null;
  source_event_id: string | null;
  idempotency_key: string | null;
  /** ISO-8601 instant the event was recorded — the row's own `created_at`, the same column the
   * query orders by. Added for the buyer-dashboard ledger view (ADR-0114), which needs a real
   * timestamp per entry rather than fabricating one. */
  created_at: string;
}

/** The append-only ledger for an account, oldest first. `sum(amount)` equals the balance. */
export async function getLedger(
  tx: TenantExecutor,
  accountId: string,
): Promise<LedgerEntry[]> {
  // `created_at` comes back as a driver-native `timestamptz` value — a JS `Date` instance on both
  // PGlite and node-postgres, NOT a string, despite the column being declared `string` on the
  // wire-facing `LedgerEntry` type. Normalize explicitly rather than trust the raw row shape (the
  // type-checker cannot catch a driver returning a different runtime type than its declared one).
  const r = await tx.query<
    Omit<LedgerEntry, "created_at"> & { created_at: unknown }
  >(
    `SELECT id, event_type, amount, feature, source_event_id, idempotency_key, created_at
     FROM credit_event WHERE account_id = $1 ORDER BY created_at, id`,
    [accountId],
  );
  return r.rows.map((row) => ({
    ...row,
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  }));
}

/**
 * Sum the credits GRANTED (positive amounts) under a given provider source event id, for an account.
 * The provenance lookup a refund uses to learn how much a one-time purchase granted (ADR-0113): a
 * one-time purchase grant lands as a `purchase` event keyed `source_event_id = <PaymentIntent id>`, so
 * the refund passes that same id here. Returns 0 when nothing was granted under it. Run inside
 * `withTenant` (RLS scopes the read to the account).
 */
export async function creditsGrantedBySource(
  tx: TenantExecutor,
  accountId: string,
  sourceEventId: string,
): Promise<number> {
  const r = await tx.query<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0)::int AS total
     FROM credit_event
     WHERE account_id = $1 AND source_event_id = $2 AND amount > 0`,
    [accountId, sourceEventId],
  );
  return r.rows[0]?.total ?? 0;
}

export interface ClawbackInput extends IdempotencySource {
  accountId: string;
  /** Credits originally granted by the refunded purchase (a positive integer). */
  amount: number;
}

export interface ClawbackResult {
  /** The wallet balance after the clawback. */
  balance: number;
  /** Credits actually reclaimed — `min(amount, prior balance)`; 0 when the buyer already spent them. */
  clawedBack: number;
  /** True when this was a no-op replay (the refund's compensating debit already landed). */
  idempotent: boolean;
}

/**
 * Claw back UNSPENT credits granted by a refunded purchase (ADR-0113, the operator-locked money
 * policy). Writes exactly ONE compensating negative `refund_clawback` ledger entry of
 * `min(amount, currentBalance)` — NEVER pushing the wallet negative: if the buyer already spent some or
 * all of those credits, only the remainder (down to 0 → no entry) is reclaimed. Idempotent on the
 * supplied id/key (a re-delivered refund does not double-claw). Append-only (ADR-0007): the clawback is
 * a new compensating entry, not a mutation of the original grant. Run inside `withTenant` so the
 * decrement is RLS-scoped + atomic with the surrounding refund transaction.
 */
export async function clawback(
  tx: TenantExecutor,
  input: ClawbackInput,
): Promise<ClawbackResult> {
  assertPositiveInt(input.amount);
  const idem = idemColumns(input);
  // LOCK the wallet row before reading the balance, so a concurrent debit cannot decrement it between
  // the read and the compensating UPDATE — otherwise the ledger row could land with no matching wallet
  // decrement, diverging sum(ledger) from balance (mirrors `debit`'s safety). A missing row → 0 (no-op).
  const locked = await tx.query<{ balance: number }>(
    `SELECT balance FROM credit_wallet WHERE account_id = $1 FOR UPDATE`,
    [input.accountId],
  );
  const current = locked.rows[0]?.balance ?? 0;
  const actual = Math.min(input.amount, current);
  if (actual === 0) {
    // Fully spent (or empty wallet): nothing unspent to reclaim. Never write a zero-amount row
    // (credit_event_amount_nonzero CHECK) — the wallet stays at its floor.
    return { balance: current, clawedBack: 0, idempotent: false };
  }
  const fresh = await insertEvent(tx, {
    accountId: input.accountId,
    eventType: "refund_clawback",
    amount: -actual,
    feature: null,
    ...idem,
  });
  if (!fresh) {
    // A re-delivered refund on the same id — the compensating debit already landed; do not repeat it.
    return { balance: current, clawedBack: 0, idempotent: true };
  }
  // We hold the row lock and actual <= current (the locked balance), so the guarded UPDATE matches.
  const r = await tx.query<{ balance: number }>(
    `UPDATE credit_wallet SET balance = balance - $2
     WHERE account_id = $1 AND balance >= $2
     RETURNING balance`,
    [input.accountId, actual],
  );
  if (r.rows.length === 0) {
    // Unreachable while the FOR UPDATE lock pins balance >= actual — but fail closed (roll back the
    // compensating debit) rather than return a fabricated balance with an orphaned ledger row.
    throw new ValidationError(
      "clawback: wallet decrement matched no row despite the row lock",
    );
  }
  return {
    balance: r.rows[0]?.balance ?? current - actual,
    clawedBack: actual,
    idempotent: false,
  };
}

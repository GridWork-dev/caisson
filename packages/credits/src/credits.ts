// Credit wallet operations (ADR-0007/0023). Integer-only. Debit-before-spend: the debit is
// recorded and the balance decremented atomically BEFORE the caller does the paid work; an empty
// or short balance throws 402 and nothing is recorded. Idempotency uses `ON CONFLICT DO NOTHING
// RETURNING` so a retried grant/debit is absorbed WITHOUT aborting the surrounding transaction
// (a caught 23505 would poison it). Run inside `withTenant` so RLS scopes the ledger.
import { randomUUID } from "node:crypto";
import {
  InsufficientCreditsError,
  ValidationError,
  type Credits,
  type RoundedMoney,
} from "@caisson/kernel";
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
  /** Integer credit units, branded (ADR-0212) — mint via `asCredits` where a raw number becomes money. */
  amount: Credits;
  /**
   * Rounding provenance (ADR-0212): the `{raw, mode, result}` record from the rounding site that
   * produced `amount` (ai-meter's ceil, `centsToCreditsProvenance`'s floor). Omitted → the row
   * persists NULL/NULL — the correct shape for an EXACT table-integer amount (ADR-0089 §5).
   */
  rounding?: RoundedMoney<number, Credits>;
  /**
   * Paddle per-line join key (ADR-0218): the `txnitm_…` transaction-item id that granted this row's
   * credits. Set on a per-line one-time `purchase` grant so a later per-line adjustment refund can
   * claw back only THAT line's credits. Omitted for every other grant/debit → NULL.
   */
  lineItemId?: string;
  /**
   * The line's charged minor units (ADR-0218): persisted alongside the per-line grant so a
   * dollar-PARTIAL refund can claw a proportional credit amount. Omitted → NULL.
   */
  lineChargedAmount?: number;
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
    /** Rounding provenance (ADR-0212) — absent → NULL/NULL (the DB CHECK keeps the pair coherent). */
    rounding?: RoundedMoney<number, Credits> | undefined;
    /** Paddle per-line join key (ADR-0218) — the `txnitm_…` that granted/refunded this row. */
    lineItemId?: string | undefined;
    /** The line's charged minor units (ADR-0218) — the proportional-refund divisor. */
    lineChargedAmount?: number | undefined;
  },
): Promise<boolean> {
  // ON CONFLICT DO NOTHING: a duplicate idempotency key returns zero rows instead of raising —
  // the transaction stays usable. `feature` is payload — NOT part of either idempotency index.
  //
  // The per-line columns are referenced ONLY when a caller supplies them (the Paddle per-line
  // purchase/refund path, ADR-0218). Every other grant/debit/clawback keeps the exact pre-0218 column
  // list, so a credit DB bootstrapped without CREDIT_LINE_ITEM_MIGRATION_SQL (ai-meter/ai-kit/cli/base
  // — they never touch a line item) is untouched: the column reference can't fail on a missing column.
  const line =
    row.lineItemId !== undefined || row.lineChargedAmount !== undefined;
  const inserted = await tx.query<{ id: string }>(
    `INSERT INTO credit_event (id, account_id, event_type, amount, feature, source_event_id, idempotency_key, rounding_raw, rounding_mode${line ? ", line_item_id, line_charged_amount" : ""})
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9${line ? ", $10, $11" : ""})
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
      row.rounding?.raw ?? null,
      row.rounding?.mode ?? null,
      ...(line ? [row.lineItemId ?? null, row.lineChargedAmount ?? null] : []),
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
    rounding: input.rounding,
    lineItemId: input.lineItemId,
    lineChargedAmount: input.lineChargedAmount,
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
    rounding: input.rounding,
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

/**
 * Sum ALL credits already CLAWED BACK against a purchase, for an account (CAISSON-5) — symmetric
 * across BOTH claw directions, since a purchase's clawbacks can arrive in either order:
 *   - a whole-transaction `type:'full'` adjustment (ADR-0113) claws by the transaction's OWN
 *     `paymentId`, recorded with `line_item_id` NULL (`source_event_id = paymentId`);
 *   - a per-line partial claw (ADR-0218) is recorded under a DIFFERENT source key
 *     (`${adjustmentId}:${itemId}`) but tagged with the line's OWN `line_item_id`.
 * Neither key alone sees the other: `source_event_id = paymentId` misses the per-line rows (their key
 * is the adjustment:item pair), and filtering by line_item_id alone misses the NULL-line whole-txn
 * row. This ORs both, so whichever clawback direction landed first is visible to whichever lands
 * second — `creditsGrantedBySource(paymentId)` minus this is the purchase's TRUE outstanding
 * remainder no matter the delivery order, closing the reversed-delivery over-claw this function's
 * name once left open. A `txnitm_…` line-item id is globally unique per transaction line, so the
 * line_item_id-scoped half can never cross into another purchase's lines, and `source_event_id`
 * equality only ever matches a whole-txn clawback's own row (a per-line clawback's key always
 * contains a `:`, never equal to a bare payment id). Returns 0 when the purchase granted no
 * per-line-keyed rows and no whole-txn claw has landed (pre-ADR-0218 / single-SKU-no-details shape) —
 * the pre-existing scalar whole-refund behavior for that case is unchanged. Run inside `withTenant`.
 */
export async function creditsClawedForSource(
  tx: TenantExecutor,
  accountId: string,
  sourceEventId: string,
): Promise<number> {
  const r = await tx.query<{ clawed: number }>(
    `SELECT COALESCE(-SUM(amount), 0)::int AS clawed
     FROM credit_event
     WHERE account_id = $1 AND amount < 0
       AND (
         source_event_id = $2
         OR line_item_id IN (
           SELECT DISTINCT line_item_id FROM credit_event
           WHERE account_id = $1 AND source_event_id = $2 AND amount > 0
             AND line_item_id IS NOT NULL AND line_item_id <> ''
         )
       )`,
    [accountId, sourceEventId],
  );
  return r.rows[0]?.clawed ?? 0;
}

/**
 * Per-line credit ledger for a Paddle transaction item (ADR-0218). `line_item_id` (`txnitm_…`) is
 * globally unique per transaction line, so filtering on it alone yields exactly one purchase's one
 * line: the `granted` positive `purchase` credits, the `clawed` sum of any prior per-line
 * `refund_clawback` debits, and the `charged` minor units (the proportional divisor). A refund reads
 * this to claw back at most the line's still-un-clawed grant — never spilling onto other lines'
 * fungible balance. Run inside `withTenant` (RLS scopes the read to the account).
 */
export interface LineCreditLedger {
  /** Positive credits this line granted at purchase time. */
  granted: number;
  /** Credits already clawed back from this line by prior per-line refunds (a non-negative integer). */
  clawed: number;
  /** The line's charged minor units — the divisor for a proportional partial-refund claw; 0 if unknown. */
  charged: number;
}

export async function lineCreditLedger(
  tx: TenantExecutor,
  accountId: string,
  lineItemId: string,
): Promise<LineCreditLedger> {
  const r = await tx.query<{
    granted: number;
    clawed: number;
    charged: number;
  }>(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0)::int AS granted,
       COALESCE(-SUM(amount) FILTER (WHERE amount < 0), 0)::int AS clawed,
       COALESCE(MAX(line_charged_amount), 0)::int AS charged
     FROM credit_event
     WHERE account_id = $1 AND line_item_id = $2`,
    [accountId, lineItemId],
  );
  const row = r.rows[0];
  return {
    granted: row?.granted ?? 0,
    clawed: row?.clawed ?? 0,
    charged: row?.charged ?? 0,
  };
}

export interface ClawbackInput extends IdempotencySource {
  accountId: string;
  /** Credits originally granted by the refunded purchase (a positive integer). */
  amount: number;
  /**
   * Paddle per-line join key (ADR-0218): the `txnitm_…` this clawback reverses. Set on a per-line
   * refund so `lineCreditLedger` can bound a later same-line claw; omitted on a whole-transaction
   * refund (keyed by the payment id) → NULL.
   */
  lineItemId?: string;
  /**
   * Rounding provenance (ADR-0212) for a PROPORTIONAL dollar-partial claw: `{raw, mode:"down"}` —
   * recorded so a floored `floor(granted * refunded / charged)` claw is auditable. Omitted on a
   * full/exact claw → NULL/NULL.
   */
  rounding?: RoundedMoney<number, Credits>;
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
    rounding: input.rounding,
    lineItemId: input.lineItemId,
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

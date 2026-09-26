// Credit wallet operations (ADR-0007/0023). Integer-only. Debit-before-spend: the debit is
// recorded and the balance decremented atomically BEFORE the caller does the paid work; an empty
// or short balance throws 402 and nothing is recorded. Idempotency uses `ON CONFLICT DO NOTHING
// RETURNING` so a retried grant/debit is absorbed WITHOUT aborting the surrounding transaction
// (a caught 23505 would poison it). Run inside `withTenant` so RLS scopes the ledger.
import { randomUUID } from "node:crypto";
import { withAdvisoryXactLock } from "@caisson-sh/jobs";
import {
  InsufficientCreditsError,
  ValidationError,
  type Credits,
  type RoundedMoney,
} from "@caisson-sh/kernel";
import { type FeatureTag, FeatureTagSchema } from "@caisson-sh/registry-schema";
import type { TenantExecutor } from "@caisson-sh/tenancy-rls";
// The pure half (ADR-0396): the event-type vocabulary, the positive-integer money rule, and the
// FIFO waterfall this file's `debit` walks. It lives in its own database-free module so a client
// surface can import it (`@caisson-sh/credits/browser`) without the FIFO rule being reimplemented.
import { assertPositiveInt, planFifoDebit } from "./fifo.ts";
import type { DebitEventType, GrantEventType } from "./fifo.ts";

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
interface GrantInputBase extends CreditInputBase {
  /**
   * When this grant's credits expire (ADR-0245/0252). Omitted → issue time + 12 months, computed
   * application-side (keeps the 12-month constant out of SQL; a grant class with a different
   * lifetime passes its own instant per the ADR-0245 carve-out).
   */
  expiresAt?: Date;
}

export type GrantInput =
  | (GrantInputBase & {
      eventType: "purchase" | "sub_allotment" | "topup";
      feature?: never;
    })
  | (GrantInputBase & { eventType: "feature_grant"; feature: FeatureTag });

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

/**
 * The current SPENDABLE balance (G37): the LOWER of the two floors `debit()` itself enforces —
 * the FIFO remaining-sum over UNEXPIRED grants, and the raw `credit_wallet.balance` aggregate.
 * Neither floor alone is correct as a display figure:
 *   - the aggregate only decrements once a day (`sweepExpiredGrants`'s cron sweep), so between a
 *     grant's expiry and the next sweep it OVERSTATES what's spendable (the original G37 gap);
 *   - the FIFO remaining-sum OVERSTATES it too after a `clawback()` — a refund decrements the
 *     wallet but writes NO `grant_consumption` rows (clawback reverses a grant's value, not a
 *     FIFO spend, see `clawback`'s own doc comment), so after refunding a partially-spent pack the
 *     per-grant remainders can sum to MORE than the wallet, and that excess is not spendable — it
 *     persists until the grants naturally expire.
 * `debit()` 402s on whichever floor is tighter; a display figure has to agree, or it promises
 * more than a debit will actually cover. This is a read-time fix: a plain read, no sweep/write
 * triggered from a page render (the alternative, sweep-before-read, belongs to an operator
 * MUTATION — a page GET stays read-only).
 */
export async function spendableBalance(
  tx: TenantExecutor,
  accountId: string,
): Promise<number> {
  const r = await tx.query<{ total: number }>(
    `SELECT COALESCE(SUM(g.amount - COALESCE(gc.consumed, 0)), 0)::int AS total
     FROM credit_event g
     LEFT JOIN (
       SELECT grant_event_id, SUM(amount) AS consumed
       FROM grant_consumption
       GROUP BY grant_event_id
     ) gc ON gc.grant_event_id = g.id
     WHERE g.account_id = $1 AND g.amount > 0 AND g.expires_at > now()`,
    [accountId],
  );
  const fifoRemaining = r.rows[0]?.total ?? 0;
  const walletAggregate = await balance(tx, accountId);
  return Math.min(fifoRemaining, walletAggregate);
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
    /** Grant expiry instant (ADR-0245/0252) — set on grant rows, NULL on debits/clawbacks. */
    expiresAt?: Date | undefined;
    /** Paddle per-line join key (ADR-0218) — the `txnitm_…` that granted/refunded this row. */
    lineItemId?: string | undefined;
    /** The line's charged minor units (ADR-0218) — the proportional-refund divisor. */
    lineChargedAmount?: number | undefined;
  },
): Promise<string | null> {
  // ON CONFLICT DO NOTHING: a duplicate idempotency key returns zero rows instead of raising —
  // the transaction stays usable (null = replay, else the fresh row's id — the FIFO consumption
  // writer needs the debit event id). `feature` is payload — NOT part of either idempotency index.
  //
  // `expires_at` is referenced unconditionally (like the rounding columns): every bootstrap of the
  // table must apply CREDIT_EXPIRY_MIGRATION_SQL. The per-line columns stay referenced ONLY when a
  // caller supplies them (the Paddle per-line purchase/refund path, ADR-0218) — a DB bootstrapped
  // without CREDIT_LINE_ITEM_MIGRATION_SQL (they never touch a line item) is untouched.
  const line =
    row.lineItemId !== undefined || row.lineChargedAmount !== undefined;
  const inserted = await tx.query<{ id: string }>(
    `INSERT INTO credit_event (id, account_id, event_type, amount, feature, source_event_id, idempotency_key, rounding_raw, rounding_mode, expires_at${line ? ", line_item_id, line_charged_amount" : ""})
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10${line ? ", $11, $12" : ""})
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
      row.expiresAt ?? null,
      ...(line ? [row.lineItemId ?? null, row.lineChargedAmount ?? null] : []),
    ],
  );
  return inserted.rows[0]?.id ?? null;
}

/** Issue + 12 months (ADR-0245) — the default grant lifetime, computed application-side. */
function defaultGrantExpiry(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 12);
  return d;
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
    expiresAt: input.expiresAt ?? defaultGrantExpiry(),
    lineItemId: input.lineItemId,
    lineChargedAmount: input.lineChargedAmount,
    ...idem,
  });
  if (fresh === null)
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
 * A grant's id + remaining (un-consumed) credits, in FIFO burn order (ADR-0252 Decision 3):
 * `created_at ASC, expires_at ASC, id ASC` — oldest first; on an issue-time tie (the real
 * shipped case: ADR-0218 multi-item cart lines share one transaction `created_at`) the
 * sooner-expiring grant burns first; the UUID id is the final deterministic tie-break (the
 * `getLedger` precedent). Only unexpired grants (`expires_at > now()`) are returned — an
 * expired grant's residue is NEVER spendable (it belongs to the expiry sweep). Remaining is
 * always derived from `grant_consumption` writes, never a mutated column (ADR-0007).
 */
async function unexpiredGrantsFifo(
  tx: TenantExecutor,
  accountId: string,
): Promise<{ id: string; remaining: number }[]> {
  const r = await tx.query<{ id: string; remaining: number }>(
    `SELECT g.id, (g.amount - COALESCE(SUM(gc.amount), 0))::int AS remaining
     FROM credit_event g
     LEFT JOIN grant_consumption gc ON gc.grant_event_id = g.id
     WHERE g.account_id = $1 AND g.amount > 0 AND g.expires_at > now()
     GROUP BY g.id, g.amount, g.created_at, g.expires_at
     HAVING g.amount - COALESCE(SUM(gc.amount), 0) > 0
     ORDER BY g.created_at ASC, g.expires_at ASC, g.id ASC`,
    [accountId],
  );
  return r.rows;
}

/** Write one `grant_consumption` row attributing `amount` of `debitEventId` to `grantEventId`. */
async function insertConsumption(
  tx: TenantExecutor,
  row: {
    accountId: string;
    grantEventId: string;
    debitEventId: string;
    amount: number;
  },
): Promise<void> {
  await tx.query(
    `INSERT INTO grant_consumption (id, account_id, grant_event_id, debit_event_id, amount)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      randomUUID(),
      row.accountId,
      row.grantEventId,
      row.debitEventId,
      row.amount,
    ],
  );
}

/**
 * Debit credits before the paid work. Atomic floor: the balance only decrements when it can
 * cover the amount, else 402 and the whole transaction rolls back (no debit recorded).
 * Idempotent on the supplied key/source.
 *
 * FIFO materialization (ADR-0245/0252): the debit walks the account's UNEXPIRED grants in burn
 * order and records which grant(s) it consumed as `grant_consumption` rows, splitting across
 * grants when one remainder can't cover it. Two floors both apply, both 402:
 *  - unexpired remaining — a debit never draws from an expired grant, even when the raw wallet
 *    aggregate is larger (the aggregate may lag the expiry sweep);
 *  - the wallet aggregate — unchanged debit-before-spend (a refund clawback can pull the wallet
 *    below the per-grant remainders, since clawback writes no consumption rows; the wallet stays
 *    the money floor).
 * Concurrency: the wallet row is locked FOR UPDATE (the `clawback` precedent) BEFORE the FIFO
 * read, serializing concurrent debits per account so two debits can never both consume the same
 * grant remainder.
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
  if (fresh === null)
    return { balance: await balance(tx, input.accountId), idempotent: true };

  // Per-account debit serialization — must precede the FIFO read (see the function comment).
  // A missing wallet row (never granted) locks nothing and falls through to the 402 below.
  await tx.query(
    `SELECT balance FROM credit_wallet WHERE account_id = $1 FOR UPDATE`,
    [input.accountId],
  );

  const grants = await unexpiredGrantsFifo(tx, input.accountId);
  const plan = planFifoDebit(grants, input.amount);
  for (const draw of plan.draws) {
    await insertConsumption(tx, {
      accountId: input.accountId,
      grantEventId: draw.grantId,
      debitEventId: fresh,
      amount: draw.taken,
    });
  }
  // Negated form: this is the 402 floor, so anything that is not provably "covered in full" must
  // take the throw. A bare `shortfall > 0` reads false for NaN and would fall through to the
  // wallet UPDATE.
  if (!(plan.shortfall <= 0)) {
    // Unexpired remaining can't cover it — 402 with the SPENDABLE total (not the raw wallet
    // aggregate, which may still carry not-yet-swept expired residue). Throwing rolls back the
    // event + consumption inserts above — a failed debit leaves no trace.
    throw new InsufficientCreditsError(input.amount, plan.covered);
  }

  const updated = await tx.query<{ balance: number }>(
    `UPDATE credit_wallet SET balance = balance - $2
     WHERE account_id = $1 AND balance >= $2
     RETURNING balance`,
    [input.accountId, input.amount],
  );
  if (updated.rows.length === 0) {
    // Insufficient wallet aggregate (e.g. a clawback outran the per-grant remainders): same
    // rollback semantics — nothing recorded.
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
   * query orders by. Added for the customer-dashboard ledger view (ADR-0114), which needs a real
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
 * Sum ALL credits already CLAWED BACK against a purchase, for an account — symmetric
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
 * The purchase's still-outstanding claw amount — the read-then-claw TOCTOU guard:
 * `granted - alreadyClawed`, floored at 0, computed UNDER an account+purchase advisory lock.
 *
 * The bug this closes: `creditsGrantedBySource`/`creditsClawedForSource` are plain SELECTs with no
 * lock. A purchase's clawback is triggered from THREE call sites — the refund webhook's
 * whole-transaction branch (`sourceEventId = paymentId`), its per-line branch (per-item keys
 * `${adjustmentId}:${itemId}`), and the admin `purchase_revoke` action (`sourceEventId =
 * purchaseId`, ADR-0225) — and the whole-txn/admin pair share a key (deduped by
 * `credit_event_source_uniq`) but the per-line keys DO NOT. Two of these racing the SAME purchase
 * concurrently (e.g. an operator revoke racing the refund webhook's per-line adjustment) can each
 * read a stale `alreadyClawed=0`, each compute the FULL outstanding amount, and each call
 * `clawback()` with a DIFFERENT key — the unique index does not dedupe them. `clawback()`'s own
 * `SELECT balance FOR UPDATE` bounds each individual write to the CURRENT wallet balance (never
 * negative), but because the wallet is a fungible pool across ALL of an account's purchases, the
 * SECOND racer's stale-computed "remaining" can still claw an UNRELATED purchase's unspent credits
 * out of the same wallet once the first racer's claw has already fully settled this purchase.
 *
 * The fix: acquire the advisory lock keyed `(accountId, purchaseSourceEventId)` FIRST — mirroring
 * `withAdvisoryXactLock`'s check-then-enqueue guard (ADR-0229 row 57) — so a second racer blocks
 * until the first commits, and by the time it re-reads `alreadyClawed` (inside this same locked
 * section) it observes the first claw's already-committed row and correctly returns 0. All three
 * call sites route through this ONE function rather than each re-deriving the bound. Run inside
 * `withTenant`.
 */
export async function outstandingClaw(
  tx: TenantExecutor,
  accountId: string,
  purchaseSourceEventId: string,
): Promise<number> {
  return withAdvisoryXactLock(
    tx,
    `credits:claw:${accountId}:${purchaseSourceEventId}`,
    async () => {
      const granted = await creditsGrantedBySource(
        tx,
        accountId,
        purchaseSourceEventId,
      );
      const alreadyClawed = await creditsClawedForSource(
        tx,
        accountId,
        purchaseSourceEventId,
      );
      return Math.max(0, granted - alreadyClawed);
    },
  );
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
  /** Credits actually reclaimed — `min(amount, prior balance)`; 0 when the customer already spent them. */
  clawedBack: number;
  /** True when this was a no-op replay (the refund's compensating debit already landed). */
  idempotent: boolean;
}

/**
 * Claw back UNSPENT credits granted by a refunded purchase (ADR-0113, the operator-locked money
 * policy). Writes exactly ONE compensating negative `refund_clawback` ledger entry of
 * `min(amount, currentBalance)` — NEVER pushing the wallet negative: if the customer already spent some or
 * all of those credits, only the remainder (down to 0 → no entry) is reclaimed. Idempotent on the
 * supplied id/key (a re-delivered refund does not double-claw). Append-only (ADR-0007): the clawback is
 * a new compensating entry, not a mutation of the original grant. Run inside `withTenant` so the
 * decrement is RLS-scoped + atomic with the surrounding refund transaction.
 *
 * FIFO coherence (ADR-0252): a clawback writes NO `grant_consumption` rows — it reverses a specific
 * grant's value, not a FIFO spend — so after a clawback the per-grant remainders can sum to MORE than
 * the wallet. That is safe by construction: `debit` keeps the wallet-aggregate floor as a second 402
 * gate, and `sweepExpiredGrants` bounds each residue burn to the live balance. The wallet is always
 * the money floor; consumption rows are the FIFO attribution trail.
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

export interface ExpiringSoon {
  /** Sum of unexpired remaining credits whose grant expires within the window. */
  credits: number;
  /** ISO-8601 instant of the soonest such expiry; null when nothing is expiring. */
  soonestExpiresAt: string | null;
}

/**
 * The dashboard-badge read (ADR-0252 Decision 6a): unexpired remaining credits expiring within
 * `withinDays` (default 30). Remaining is derived per grant from `grant_consumption` — the same
 * waterfall `debit` writes — so the badge matches what a debit could actually still spend.
 */
export async function expiringSoon(
  tx: TenantExecutor,
  accountId: string,
  withinDays = 30,
): Promise<ExpiringSoon> {
  const cutoff = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);
  const r = await tx.query<{ credits: number; soonest: unknown }>(
    `SELECT COALESCE(SUM(t.remaining), 0)::int AS credits, MIN(t.expires_at) AS soonest
     FROM (
       SELECT (g.amount - COALESCE(SUM(gc.amount), 0))::int AS remaining, g.expires_at
       FROM credit_event g
       LEFT JOIN grant_consumption gc ON gc.grant_event_id = g.id
       WHERE g.account_id = $1 AND g.amount > 0
         AND g.expires_at > now() AND g.expires_at <= $2
       GROUP BY g.id, g.amount, g.expires_at
       HAVING g.amount - COALESCE(SUM(gc.amount), 0) > 0
     ) t`,
    [accountId, cutoff],
  );
  const row = r.rows[0];
  const soonest = row?.soonest ?? null;
  return {
    credits: row?.credits ?? 0,
    soonestExpiresAt:
      soonest === null
        ? null
        : soonest instanceof Date
          ? soonest.toISOString()
          : String(soonest),
  };
}

export interface ExpirySweepResult {
  /** Grants whose residue was burned by this run (replays and zero-residue grants excluded). */
  grantsExpired: number;
  /** Total credits removed from the wallet by this run. */
  creditsExpired: number;
}

/**
 * The idempotent expiry sweep (ADR-0252 Decision 5): for each EXPIRED grant with residue, write
 * one `expiry_debit` ledger event + a `grant_consumption` row and decrement the wallet — expired
 * value is consumed by an explicit ledger event, never silently excluded from reads. Idempotent
 * per grant twice over: consuming the residue zeroes it (a re-run selects nothing), and the
 * event's idempotency key (`expiry:<grant id>`) absorbs the clawback-drained corner where a burn
 * was bounded below the residue (the key is spent, so the leftover phantom residue on an already
 * EXPIRED grant can never double-decrement — and it is invisible to debits and the badge, which
 * only read unexpired grants). Each burn is bounded to the live balance (`clawback` semantics:
 * the wallet never goes negative, sum(ledger) stays equal to balance). Run inside `withTenant`.
 */
export async function sweepExpiredGrants(
  tx: TenantExecutor,
  accountId: string,
): Promise<ExpirySweepResult> {
  // Same per-account serialization as `debit`/`clawback`: lock the wallet row first.
  const locked = await tx.query<{ balance: number }>(
    `SELECT balance FROM credit_wallet WHERE account_id = $1 FOR UPDATE`,
    [accountId],
  );
  let bal = locked.rows[0]?.balance ?? 0;
  const expired = await tx.query<{ id: string; residue: number }>(
    `SELECT g.id, (g.amount - COALESCE(SUM(gc.amount), 0))::int AS residue
     FROM credit_event g
     LEFT JOIN grant_consumption gc ON gc.grant_event_id = g.id
     WHERE g.account_id = $1 AND g.amount > 0 AND g.expires_at <= now()
     GROUP BY g.id, g.amount, g.created_at, g.expires_at
     HAVING g.amount - COALESCE(SUM(gc.amount), 0) > 0
     ORDER BY g.created_at ASC, g.expires_at ASC, g.id ASC`,
    [accountId],
  );
  let grantsExpired = 0;
  let creditsExpired = 0;
  for (const g of expired.rows) {
    const burn = Math.min(g.residue, bal);
    // An empty wallet leaves the grant's residue un-burned WITHOUT spending its idempotency key —
    // a later sweep (after the balance recovers) can still close it.
    if (burn === 0) continue;
    const eventId = await insertEvent(tx, {
      accountId,
      eventType: "expiry_debit",
      amount: -burn,
      feature: null,
      sourceEventId: null,
      idempotencyKey: `expiry:${g.id}`,
    });
    if (eventId === null) continue; // replay — this grant's expiry already landed
    await insertConsumption(tx, {
      accountId,
      grantEventId: g.id,
      debitEventId: eventId,
      amount: burn,
    });
    const updated = await tx.query<{ balance: number }>(
      `UPDATE credit_wallet SET balance = balance - $2
       WHERE account_id = $1 AND balance >= $2
       RETURNING balance`,
      [accountId, burn],
    );
    if (updated.rows.length === 0) {
      // Unreachable while the FOR UPDATE lock pins balance >= burn — fail closed (mirrors clawback).
      throw new ValidationError(
        "expiry sweep: wallet decrement matched no row despite the row lock",
      );
    }
    bal = updated.rows[0]?.balance ?? bal - burn;
    grantsExpired += 1;
    creditsExpired += burn;
  }
  return { grantsExpired, creditsExpired };
}

/**
 * The minimal structural slice of `@caisson-sh/email`'s `Emailer` port — declared locally so the
 * credits package needs no email dependency; any real `Emailer` satisfies it.
 */
export interface ExpiryNoticeEmailer {
  send(msg: {
    to: string;
    template: string;
    data: Record<string, unknown>;
  }): Promise<void>;
}

export interface ExpiryNoticeInput {
  /** Where the notice goes — resolved by the caller (credits knows accounts, not inboxes). */
  recipient: string;
  emailer: ExpiryNoticeEmailer;
  /** The CTA link — the customer credits dashboard. */
  dashboardUrl: string;
  /** Notice window in days before expiry (ADR-0252 Decision 6b: 30). */
  withinDays?: number;
}

/**
 * The T-30d expiry-notice sweep (ADR-0252 Decision 6b): for each unexpired grant with remaining
 * credits expiring within the window that has NOT been noticed, insert the append-only
 * `credit_expiry_notice` marker (`ON CONFLICT DO NOTHING` — the PK is the grant id) and send the
 * `credits-expiring` email. Notified-once: the marker row gates the send; a replayed sweep inserts
 * nothing and sends nothing. The send runs INSIDE the transaction after the marker insert, so a
 * failed send rolls the marker back and the next sweep retries. Returns the number of notices sent.
 */
export async function sweepExpiryNotices(
  tx: TenantExecutor,
  accountId: string,
  input: ExpiryNoticeInput,
): Promise<number> {
  const withinDays = input.withinDays ?? 30;
  const cutoff = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);
  const due = await tx.query<{
    id: string;
    remaining: number;
    expires_at: unknown;
  }>(
    `SELECT g.id, (g.amount - COALESCE(SUM(gc.amount), 0))::int AS remaining, g.expires_at
     FROM credit_event g
     LEFT JOIN grant_consumption gc ON gc.grant_event_id = g.id
     WHERE g.account_id = $1 AND g.amount > 0
       AND g.expires_at > now() AND g.expires_at <= $2
       AND NOT EXISTS (
         SELECT 1 FROM credit_expiry_notice n WHERE n.grant_event_id = g.id
       )
     GROUP BY g.id, g.amount, g.created_at, g.expires_at
     HAVING g.amount - COALESCE(SUM(gc.amount), 0) > 0
     ORDER BY g.created_at ASC, g.expires_at ASC, g.id ASC`,
    [accountId, cutoff],
  );
  let sent = 0;
  for (const g of due.rows) {
    const marked = await tx.query<{ grant_event_id: string }>(
      `INSERT INTO credit_expiry_notice (grant_event_id, account_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING grant_event_id`,
      [g.id, accountId],
    );
    if (marked.rows.length === 0) continue; // raced/replayed — already noticed
    const expiresOn = (
      g.expires_at instanceof Date
        ? g.expires_at
        : new Date(String(g.expires_at))
    )
      .toISOString()
      .slice(0, 10);
    await input.emailer.send({
      to: input.recipient,
      template: "credits-expiring",
      data: {
        credits: g.remaining,
        expiresOn,
        url: input.dashboardUrl,
      },
    });
    sent += 1;
  }
  return sent;
}

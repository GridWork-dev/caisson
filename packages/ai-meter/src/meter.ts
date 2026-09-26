// The metered-inference money path (ADR-0060): estimate → reserve → reconcile, over the append-only
// credit ledger (@caisson-sh/credits, ADR-0074 generic `feature_debit`/`feature_grant` carrying the
// registered `inference_call` tag) plus the per-tenant spend window + circuit breaker.
//
//   reserve()  — checked breaker FIRST (open → 402, no provider call); estimate the cost; debit the
//                wallet pre-call (402 on a short wallet rolls the whole tenant transaction back, so a
//                failed reservation leaves NO trace); bump the atomic spend window; a crossed hard cap
//                trips the breaker so the NEXT reserve 402s.
//   reconcile()— true the charge to the provider's ACTUAL usage: a `feature_grant` refund when the
//                estimate over-reserved, a `feature_debit` shortfall when it under-reserved, no credit
//                row at all when the delta is zero. The append-only `usage_event (account, call_id)`
//                UNIQUE is the idempotency anchor — a retried reconcile settles exactly once.
//
// Credits are integer units throughout (ADR-0007); the spend window mutates only via an atomic
// `INSERT … ON CONFLICT DO UPDATE … RETURNING`, so concurrent reserves can't lose an increment.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { balance, debit, grant } from "@caisson-sh/credits";
import { asCredits, parseStrict, strictObject } from "@caisson-sh/kernel";
import type { TenantExecutor } from "@caisson-sh/tenancy-rls";
import { estimateCost, estimateMessageSchema } from "./estimate.ts";
import type { EstimateMessage } from "./estimate.ts";
import {
  BUNDLED_PRICE_BOOK,
  computeCost,
  CREDIT_CONVERSION,
  resolvePriceEntry,
  usageSchema,
} from "./token-rates.ts";
import type { CreditConversion, PriceBook, Usage } from "./token-rates.ts";
import { assertBreakerClosed, tripBreaker } from "./breaker.ts";
import { DEFAULT_SCOPE } from "./contracts.ts";
import {
  SPEND_POLICY_TABLE,
  TENANT_SPEND_WINDOW_TABLE,
  USAGE_EVENT_TABLE,
} from "./schema.ts";

/** The registered feature tag (ADR-0074) every meter ledger event carries. */
const INFERENCE_FEATURE = "inference_call";

/** The meter tracks running spend + caps in CREDIT units (integer money, ADR-0007). */
const SPEND_UNIT = "credits";

/** The window-granularity fallback when no policy declares one. */
const DEFAULT_GRANULARITY = "month";

/** Developer-supplied config (a `forge.config` block); all fields default. */
export interface MeterConfig {
  /** Override the bundled price book (validate with `parsePriceBook` at the edge). */
  priceBook?: PriceBook;
  /** Override the credit denomination. */
  conversion?: CreditConversion;
  /** The aggregation scope a cap/breaker/window key on. Default `"account"`. */
  scope?: string;
  /** Injectable clock for the window-key bucket (determinism in tests). Default `new Date()`. */
  now?: Date;
}

export interface ReserveInput {
  accountId: string;
  /** The gateway's per-call correlation id; the idempotency anchor for both legs. */
  callId: string;
  provider: string;
  model: string;
  lane: string;
  messages: EstimateMessage[];
  maxOutputTokens?: number;
  /**
   * The lane's key source (ADR-0182). `"tenant"` (BYOK) debits $0 from the wallet — the caller
   * supplied their own provider key — while internal metering (spend window + caps) still runs.
   * Omitted/`"env"` is the platform key: billed as usual.
   */
  keySource?: "env" | "tenant";
  config?: MeterConfig;
}

export interface ReserveResult {
  /** Integer credits debited to hold the reservation (feed this back to `reconcile`). */
  reservedCredits: number;
  /** Wallet balance after the reservation. */
  balance: number;
  /** Running spend in the current window (credits) after this reserve. */
  spent: number;
  /** A soft cap was reached — a warning signal, not a block. */
  softExceeded: boolean;
  /** This reserve crossed the hard cap and tripped the breaker (the NEXT reserve 402s). */
  breakerTripped: boolean;
  /** True when this was an idempotent replay of an already-applied reservation. */
  idempotent: boolean;
  /**
   * The spend-window bucket this reserve accounted into — thread it back into `reconcile()` so a
   * call straddling a day/month boundary trues its delta into the SAME bucket it reserved against.
   */
  windowKey: string;
}

export interface ReconcileInput {
  accountId: string;
  callId: string;
  provider: string;
  model: string;
  lane: string;
  /** What `reserve()` debited — the baseline the actual is trued against. */
  reservedCredits: number;
  /** The provider's actual usage (the estimate tokens when the provider reported none). */
  usage: Usage;
  /**
   * False when the provider completed the call but reported NO usage. Settle at the reserved
   * estimate (delta 0 — never refund a real completed call to zero) rather than trueing down.
   * Defaults to true.
   */
  usageReported?: boolean;
  /**
   * The reserve leg's spend-window bucket (`ReserveResult.windowKey`). When set, `reconcile()`
   * trues the delta into THIS bucket instead of recomputing one from a fresh clock — so a boundary-
   * straddling call can't misattribute its delta to the next day/month.
   */
  windowKey?: string;
  /** The lane's key source (ADR-0182); `"tenant"` (BYOK) makes no wallet movement at reconcile. */
  keySource?: "env" | "tenant";
  /** The prompt_registry version that produced the call (the version→usage link); null for ad-hoc. */
  promptVersionId?: string | null;
  config?: MeterConfig;
}

export interface ReconcileResult {
  /** Integer credits the actual usage costs. */
  actualCredits: number;
  /** The actual integer micro-USD cost (recorded on the usage_event). */
  costMicroUsd: number;
  /** Signed actual − reserved (negative = over-reserved). */
  deltaCredits: number;
  /** Credits refunded to the wallet (a `feature_grant`). */
  refundedCredits: number;
  /** Credits charged as a shortfall (a `feature_debit`). */
  chargedCredits: number;
  /** Wallet balance after settlement. */
  balance: number;
  /** Running spend in the current window (credits) after reconcile. */
  spent: number;
  softExceeded: boolean;
  breakerTripped: boolean;
  /** True when the call was already reconciled — settled once, no double charge. */
  idempotent: boolean;
}

interface ResolvedConfig {
  priceBook: PriceBook;
  conversion: CreditConversion;
  scope: string;
  now: Date;
}

interface PolicyRow {
  soft_limit: number | null;
  hard_limit: number | null;
  window_granularity: string;
}

const reserveCoreSchema = strictObject({
  accountId: z.string().min(1),
  callId: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  lane: z.string().min(1),
  messages: z.array(estimateMessageSchema),
  // 0 is legal (ADR-0360 S2): a non-generating action (a tool step) reserves with empty messages +
  // maxOutputTokens 0 — a zero-credit reservation that still runs the breaker/caps gate up front.
  maxOutputTokens: z.number().int().nonnegative().optional(),
  keySource: z.enum(["env", "tenant"]).optional(),
});

const reconcileCoreSchema = strictObject({
  accountId: z.string().min(1),
  callId: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  lane: z.string().min(1),
  reservedCredits: z.number().int().nonnegative(),
  usage: usageSchema,
  usageReported: z.boolean().optional(),
  windowKey: z.string().min(1).optional(),
  keySource: z.enum(["env", "tenant"]).optional(),
  promptVersionId: z.string().min(1).nullable().optional(),
});

function resolveConfig(config: MeterConfig | undefined): ResolvedConfig {
  return {
    priceBook: config?.priceBook ?? BUNDLED_PRICE_BOOK,
    conversion: config?.conversion ?? CREDIT_CONVERSION,
    scope: config?.scope ?? DEFAULT_SCOPE,
    now: config?.now ?? new Date(),
  };
}

/** Bucket the running spend window by the policy granularity (UTC, deterministic given `now`). */
function windowKey(granularity: string, now: Date): string {
  const iso = now.toISOString();
  if (granularity === "day") return iso.slice(0, 10);
  if (granularity === "month") return iso.slice(0, 7);
  return "all";
}

async function loadPolicy(
  tx: TenantExecutor,
  accountId: string,
  scope: string,
): Promise<PolicyRow | null> {
  const r = await tx.query<PolicyRow>(
    `SELECT soft_limit, hard_limit, window_granularity FROM ${SPEND_POLICY_TABLE}
       WHERE account_id = $1 AND scope = $2 AND unit = $3`,
    [accountId, scope, SPEND_UNIT],
  );
  return r.rows[0] ?? null;
}

/**
 * Atomic running-spend mutation, returning the new total. A non-negative `amount` upserts (the window
 * row may not exist yet — the reservation creates it). A negative `amount` (a reconcile refund) is a
 * plain UPDATE on the row the reservation already created: `ON CONFLICT` only arbitrates UNIQUE
 * violations, so a negative VALUES tuple would trip the `spent >= 0` CHECK during the insert attempt
 * BEFORE the conflict resolves — the UPDATE instead evaluates the CHECK on the resulting (>= 0) row.
 */
async function bumpSpend(
  tx: TenantExecutor,
  accountId: string,
  scope: string,
  key: string,
  amount: number,
): Promise<number> {
  if (amount >= 0) {
    const r = await tx.query<{ spent: number }>(
      `INSERT INTO ${TENANT_SPEND_WINDOW_TABLE} (account_id, scope, unit, window_key, spent)
         VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (account_id, scope, unit, window_key)
         DO UPDATE SET spent = ${TENANT_SPEND_WINDOW_TABLE}.spent + EXCLUDED.spent,
                       updated_at = now()
         RETURNING spent`,
      [accountId, scope, SPEND_UNIT, key, amount],
    );
    return r.rows[0]?.spent ?? amount;
  }
  const r = await tx.query<{ spent: number }>(
    `UPDATE ${TENANT_SPEND_WINDOW_TABLE} SET spent = spent + $5, updated_at = now()
       WHERE account_id = $1 AND scope = $2 AND unit = $3 AND window_key = $4
       RETURNING spent`,
    [accountId, scope, SPEND_UNIT, key, amount],
  );
  return r.rows[0]?.spent ?? 0;
}

async function readSpend(
  tx: TenantExecutor,
  accountId: string,
  scope: string,
  key: string,
): Promise<number> {
  const r = await tx.query<{ spent: number }>(
    `SELECT spent FROM ${TENANT_SPEND_WINDOW_TABLE}
       WHERE account_id = $1 AND scope = $2 AND unit = $3 AND window_key = $4`,
    [accountId, scope, SPEND_UNIT, key],
  );
  return r.rows[0]?.spent ?? 0;
}

/** Evaluate caps against a new running total: a crossed hard cap trips the breaker. */
async function evaluateCaps(
  tx: TenantExecutor,
  accountId: string,
  scope: string,
  newSpent: number,
  policy: PolicyRow | null,
): Promise<{ softExceeded: boolean; breakerTripped: boolean }> {
  if (policy === null) return { softExceeded: false, breakerTripped: false };
  let breakerTripped = false;
  if (policy.hard_limit !== null && newSpent >= policy.hard_limit) {
    await tripBreaker(tx, accountId, scope, "hard spend cap reached");
    breakerTripped = true;
  }
  const softExceeded =
    policy.soft_limit !== null && newSpent >= policy.soft_limit;
  return { softExceeded, breakerTripped };
}

/**
 * Reserve credits for a metered call BEFORE the provider is invoked. Throws `SpendCapError` (402)
 * when the breaker is open and `InsufficientCreditsError` (402) when the wallet is short — in either
 * case nothing is written (the surrounding `withTenant` transaction rolls back). Run inside
 * `withTenant(accountId)`.
 *
 * A caller wanting to catch near-duplicate prompts (not just literal `callId` retries) should call
 * `checkDedupGate()` from `./dedup.ts` BEFORE this — it detects, it does not enforce (ADR-0217).
 */
export async function reserve(
  tx: TenantExecutor,
  input: ReserveInput,
): Promise<ReserveResult> {
  const core = parseStrict(reserveCoreSchema, {
    accountId: input.accountId,
    callId: input.callId,
    provider: input.provider,
    model: input.model,
    lane: input.lane,
    messages: input.messages,
    ...(input.maxOutputTokens !== undefined
      ? { maxOutputTokens: input.maxOutputTokens }
      : {}),
    ...(input.keySource !== undefined ? { keySource: input.keySource } : {}),
  });
  const cfg = resolveConfig(input.config);

  // Breaker is checked BEFORE every reserve (ADR-0060): open → 402, no provider spend.
  await assertBreakerClosed(tx, core.accountId, cfg.scope);

  const entry = resolvePriceEntry(cfg.priceBook, core.provider, core.model);
  const est = estimateCost(
    core.messages,
    entry,
    cfg.conversion,
    core.maxOutputTokens,
  );
  const reservedCredits = est.credits;
  // BYOK (ADR-0182): the caller brought their own provider key, so a metered action debits $0.
  // Internal metering (the spend window + caps) still runs — but for BYOK it accrues at RECONCILE (to
  // the actual), not here: a BYOK reserve has no wallet-debit to anchor idempotency on, so pre-counting
  // it would double-count the window on a same-callId retry. Keeping it out until reconcile makes the
  // reserve a no-op (retry-safe) while the usage_event UNIQUE keeps the reconcile accrual idempotent.
  const billable = core.keySource !== "tenant";

  let walletBalance: number;
  let idempotent: boolean;
  if (billable && reservedCredits > 0) {
    // Debit-before-spend (ADR-0007): a short wallet throws 402 and rolls everything back. The
    // estimate's rounding provenance (ADR-0212: raw micro-USD, mode "up") persists on the ledger row.
    const res = await debit(tx, {
      accountId: core.accountId,
      amount: reservedCredits,
      eventType: "feature_debit",
      feature: INFERENCE_FEATURE,
      idempotencyKey: `${core.callId}:reserve`,
      rounding: est.roundingCredits,
    });
    walletBalance = res.balance;
    idempotent = res.idempotent;
  } else {
    // Nothing to hold: a BYOK lane bills $0, and a zero-credit estimate holds nothing either way.
    walletBalance = await balance(tx, core.accountId);
    idempotent = false;
  }

  const policy = await loadPolicy(tx, core.accountId, cfg.scope);
  const key = windowKey(
    policy?.window_granularity ?? DEFAULT_GRANULARITY,
    cfg.now,
  );

  // Only a FRESH billable reservation pre-counts its estimate into the window (reserving headroom so
  // concurrent calls can't all slip under the cap). A replay, a zero estimate, or a BYOK lane moves
  // nothing here — BYOK accrues the full actual at reconcile instead.
  // BYOK caps therefore settle post-call; a concurrent BYOK burst can momentarily exceed the
  // cap before the first reconcile trips the breaker — acceptable (no wallet at risk). Pre-count BYOK
  // only if a reservation-marker table is added to anchor its reserve idempotency.
  if (idempotent || reservedCredits === 0 || !billable) {
    return {
      reservedCredits,
      balance: walletBalance,
      spent: await readSpend(tx, core.accountId, cfg.scope, key),
      softExceeded: false,
      breakerTripped: false,
      idempotent,
      windowKey: key,
    };
  }

  const spent = await bumpSpend(
    tx,
    core.accountId,
    cfg.scope,
    key,
    reservedCredits,
  );
  const caps = await evaluateCaps(tx, core.accountId, cfg.scope, spent, policy);
  return {
    reservedCredits,
    balance: walletBalance,
    spent,
    softExceeded: caps.softExceeded,
    breakerTripped: caps.breakerTripped,
    idempotent: false,
    windowKey: key,
  };
}

/**
 * Reconcile a metered call to its ACTUAL usage. Records the append-only `usage_event`, refunds an
 * over-reservation (`feature_grant`) or charges a shortfall (`feature_debit`), and trues the spend
 * window to actuals. Idempotent on `(account, call_id)` — a retry settles exactly once. Run inside
 * `withTenant(accountId)`.
 */
export async function reconcile(
  tx: TenantExecutor,
  input: ReconcileInput,
): Promise<ReconcileResult> {
  const core = parseStrict(reconcileCoreSchema, {
    accountId: input.accountId,
    callId: input.callId,
    provider: input.provider,
    model: input.model,
    lane: input.lane,
    reservedCredits: input.reservedCredits,
    usage: input.usage,
    ...(input.usageReported !== undefined
      ? { usageReported: input.usageReported }
      : {}),
    ...(input.windowKey !== undefined ? { windowKey: input.windowKey } : {}),
    ...(input.keySource !== undefined ? { keySource: input.keySource } : {}),
    ...(input.promptVersionId !== undefined
      ? { promptVersionId: input.promptVersionId }
      : {}),
  });
  const cfg = resolveConfig(input.config);
  // BYOK (ADR-0182) makes no wallet movement; the usage_event + window/cap below still run.
  const billable = core.keySource !== "tenant";
  const usageReported = core.usageReported ?? true;

  const entry = resolvePriceEntry(cfg.priceBook, core.provider, core.model);
  const actual = computeCost(core.usage, entry, cfg.conversion);
  // A provider that completed the call but reported no usage settles at the RESERVED estimate
  // (delta 0 — no refund of a real completed call) while still recording the estimate token counts.
  const settledCredits = usageReported ? actual.credits : core.reservedCredits;
  const policy = await loadPolicy(tx, core.accountId, cfg.scope);
  // Reuse the reserve leg's bucket when threaded in (never recompute from a fresh clock) so a call
  // straddling a day/month boundary trues its delta into the SAME bucket it reserved against.
  const key =
    core.windowKey ??
    windowKey(policy?.window_granularity ?? DEFAULT_GRANULARITY, cfg.now);

  // The append-only usage_event UNIQUE (account, call_id) is the reconcile idempotency anchor.
  const ins = await tx.query<{ id: string }>(
    `INSERT INTO ${USAGE_EVENT_TABLE}
       (id, account_id, call_id, prompt_version_id, lane, provider, model,
        input_tokens, output_tokens, cached_input_tokens, cost_micro_usd, credits)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (account_id, call_id) DO NOTHING
     RETURNING id`,
    [
      randomUUID(),
      core.accountId,
      core.callId,
      core.promptVersionId ?? null,
      core.lane,
      core.provider,
      core.model,
      core.usage.inputTokens,
      core.usage.outputTokens,
      core.usage.cachedInputTokens,
      actual.costMicroUsd,
      settledCredits,
    ],
  );

  // Already reconciled → settle once: no second charge, no second window move.
  if (ins.rows.length === 0) {
    return {
      actualCredits: settledCredits,
      costMicroUsd: actual.costMicroUsd,
      deltaCredits: 0,
      refundedCredits: 0,
      chargedCredits: 0,
      balance: await balance(tx, core.accountId),
      spent: await readSpend(tx, core.accountId, cfg.scope, key),
      softExceeded: false,
      breakerTripped: false,
      idempotent: true,
    };
  }

  const delta = settledCredits - core.reservedCredits;
  let walletBalance = await balance(tx, core.accountId);
  let refundedCredits = 0;
  let chargedCredits = 0;
  // Either settlement row carries the ACTUAL cost's rounding provenance (ADR-0212): the row's amount
  // is the signed delta, while {raw, mode, result} document the ceil that produced the actual charge.
  if (billable && delta > 0) {
    const res = await debit(tx, {
      accountId: core.accountId,
      amount: asCredits(delta),
      eventType: "feature_debit",
      feature: INFERENCE_FEATURE,
      idempotencyKey: `${core.callId}:reconcile`,
      rounding: actual.roundingCredits,
    });
    walletBalance = res.balance;
    chargedCredits = delta;
  } else if (billable && delta < 0) {
    const res = await grant(tx, {
      accountId: core.accountId,
      amount: asCredits(-delta),
      eventType: "feature_grant",
      feature: INFERENCE_FEATURE,
      idempotencyKey: `${core.callId}:reconcile`,
      rounding: actual.roundingCredits,
    });
    walletBalance = res.balance;
    refundedCredits = -delta;
  }
  // delta === 0 (or a BYOK lane): no credit row moves — the wallet stays put.

  // Move the window to reflect ACTUAL spend. A billable reserve already pre-counted the estimate, so
  // reconcile applies just the delta; a BYOK reserve counted nothing, so reconcile accrues the FULL
  // actual here. Either way the usage_event UNIQUE above makes this move idempotent on retry.
  const windowMove = billable ? delta : settledCredits;
  const spent =
    windowMove !== 0
      ? await bumpSpend(tx, core.accountId, cfg.scope, key, windowMove)
      : await readSpend(tx, core.accountId, cfg.scope, key);
  const caps = await evaluateCaps(tx, core.accountId, cfg.scope, spent, policy);

  return {
    actualCredits: settledCredits,
    costMicroUsd: actual.costMicroUsd,
    deltaCredits: delta,
    refundedCredits,
    chargedCredits,
    balance: walletBalance,
    spent,
    softExceeded: caps.softExceeded,
    breakerTripped: caps.breakerTripped,
    idempotent: false,
  };
}

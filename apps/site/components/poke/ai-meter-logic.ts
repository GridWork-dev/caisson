// Pure, deterministic mirror of @caisson/ai-meter's math (packages/ai-meter/src/pricebook.ts +
// estimate.ts) plus a local, synchronous replay of the reserve/reconcile/breaker state machine
// (packages/ai-meter/src/meter.ts + breaker.ts). The real reserve()/reconcile() are async and
// DB-backed (@caisson/tenancy-rls, @caisson/credits), meter.ts imports node:crypto, and the
// package's ONLY public exports are "." and "./ui" (package.json `exports`) - the "." barrel
// (src/index.ts) re-exports schema.ts (which imports @caisson/tenancy-rls) and meter.ts in the SAME
// module graph as the pure pricebook.ts/estimate.ts functions, and no subpath exists to reach the
// pure files alone. None of that resolves in a browser bundle, so every constant and function below
// is mirrored number-identical to the real package by hand and pinned in ai-meter-logic.test.ts,
// which imports the real "@caisson/ai-meter" package directly (tests run under bun, not a browser)
// and asserts parity - including against the shipped packages/ai-meter/src/__golden__/cost.json
// fixture.
//
// No Date.now(), no Math.random(): the spend-window bucket is a fixed sample key and every
// reserve/reconcile call id is a session-scoped counter, so replaying the same click sequence always
// produces the same numbers.

/** Mirrors PRICE_BOOK_VERSION, packages/ai-meter/src/pricebook.ts. */
export const PRICE_BOOK_VERSION = "2026-07-06";

/** Mirrors CREDIT_CONVERSION.microUsdPerCredit, packages/kernel/src/credit-conversion.ts (the one
 *  credit denomination ai-meter's cost book imports from kernel; never overridden in this poke). */
export const MICRO_USD_PER_CREDIT = 1000;

/** Mirrors CHARS_PER_TOKEN, packages/ai-meter/src/estimate.ts. */
export const CHARS_PER_TOKEN = 4;

/** Mirrors DEFAULT_OUTPUT_TOKENS, packages/ai-meter/src/estimate.ts. */
export const DEFAULT_OUTPUT_TOKENS = 1024;

export interface PriceBookEntry {
  inputPerMTok: number;
  cachedInputPerMTok: number;
  outputPerMTok: number;
}

/** Mirrors BUNDLED_PRICE_BOOK, packages/ai-meter/src/pricebook.ts. Rates are integer micro-USD per
 *  million tokens (ADR-0007). */
export const BUNDLED_PRICE_BOOK = {
  "openai/gpt-4o-mini": {
    inputPerMTok: 150_000,
    cachedInputPerMTok: 75_000,
    outputPerMTok: 600_000,
  },
  "anthropic/claude-3-5-haiku": {
    inputPerMTok: 800_000,
    cachedInputPerMTok: 80_000,
    outputPerMTok: 4_000_000,
  },
  "anthropic/claude-sonnet-4.5": {
    inputPerMTok: 3_000_000,
    cachedInputPerMTok: 300_000,
    outputPerMTok: 15_000_000,
  },
  "google/gemini-1.5-flash": {
    inputPerMTok: 75_000,
    cachedInputPerMTok: 18_750,
    outputPerMTok: 300_000,
  },
  "openai/text-embedding-3-small": {
    inputPerMTok: 20_000,
    cachedInputPerMTok: 20_000,
    outputPerMTok: 0,
  },
} as const satisfies Record<string, PriceBookEntry>;

export type ModelKey = keyof typeof BUNDLED_PRICE_BOOK;

export const MODEL_KEYS = Object.keys(BUNDLED_PRICE_BOOK) as ModelKey[];

/** Mirrors priceKey(), packages/ai-meter/src/pricebook.ts. */
export function priceKey(provider: string, model: string): string {
  return `${provider}/${model}`;
}

/** Mirrors resolvePriceEntry(), packages/ai-meter/src/pricebook.ts - fail-closed: an unknown model
 *  throws rather than metering at zero. */
export function resolvePriceEntry(model: ModelKey): PriceBookEntry {
  const entry = BUNDLED_PRICE_BOOK[model];
  if (entry === undefined) {
    throw new Error(`no price-book entry for ${model}`);
  }
  return entry;
}

const MICRO_PER_MTOK = 1_000_000n;

/** Ceiling division over non-negative BigInts - the single rounding rule (round UP), mirrors the
 *  private ceilDiv() in packages/ai-meter/src/pricebook.ts. */
function ceilDiv(numer: bigint, denom: bigint): bigint {
  return (numer + denom - 1n) / denom;
}

function legMicroUsd(tokens: number, perMTok: number): number {
  return Number(ceilDiv(BigInt(tokens) * BigInt(perMTok), MICRO_PER_MTOK));
}

export interface Usage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

export interface CostBreakdown {
  costMicroUsd: number;
  credits: number;
}

/** Mirrors creditsForMicroUsd(), packages/ai-meter/src/pricebook.ts. */
export function creditsForMicroUsd(costMicroUsd: number): number {
  if (costMicroUsd === 0) return 0;
  return Number(ceilDiv(BigInt(costMicroUsd), BigInt(MICRO_USD_PER_CREDIT)));
}

/** Mirrors computeCost(), packages/ai-meter/src/pricebook.ts: each token leg (non-cached input,
 *  cached input, output) rounds UP independently, then the legs sum (ADR-0007/0060 - never
 *  under-bill a partial-cache mix). */
export function computeCost(
  usage: Usage,
  entry: PriceBookEntry,
): CostBreakdown {
  const nonCachedInput = usage.inputTokens - usage.cachedInputTokens;
  const costMicroUsd =
    legMicroUsd(nonCachedInput, entry.inputPerMTok) +
    legMicroUsd(usage.cachedInputTokens, entry.cachedInputPerMTok) +
    legMicroUsd(usage.outputTokens, entry.outputPerMTok);
  return { costMicroUsd, credits: creditsForMicroUsd(costMicroUsd) };
}

export interface EstimateMessage {
  role: string;
  content: string;
}

/** Mirrors estimateTokens(), packages/ai-meter/src/estimate.ts - the ~4-characters-per-token
 *  heuristic. */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Mirrors estimateUsage(), packages/ai-meter/src/estimate.ts: the reservation's conservative usage
 *  shape (no cache assumed - reconcile trues it up to the actual). */
export function estimateUsage(
  messages: EstimateMessage[],
  maxOutputTokens?: number,
): Usage {
  const inputTokens = messages.reduce(
    (sum, m) => sum + estimateTokens(m.content),
    0,
  );
  return {
    inputTokens,
    cachedInputTokens: 0,
    outputTokens: maxOutputTokens ?? DEFAULT_OUTPUT_TOKENS,
  };
}

// ---- Local session replay (mirrors packages/ai-meter/src/meter.ts + breaker.ts) ----

export type BreakerState = "closed" | "open";

/** Mirrors SpendCapError's code/httpStatus/message shape, packages/ai-meter/src/breaker.ts. The real
 *  class extends @caisson/kernel's CaissonError and stores the same three fields; this mirror skips
 *  only the DB-facing `details` allowlisting, which this client-only replay never writes anywhere. */
export class SpendCapErrorMirror extends Error {
  readonly code = "spend_cap_reached";
  readonly httpStatus = 402;
  readonly scope: string;
  constructor(
    scope: string,
    message = "Spend cap reached: circuit breaker open",
  ) {
    super(message);
    this.name = "SpendCapError";
    this.scope = scope;
  }
}

/** The golden actual usage from packages/ai-meter/src/__golden__/cost.json ("openai-partial-cache"):
 *  input 12000, cached 8000, output 800 -> costMicroUsd 1680, credits 2 against openai/gpt-4o-mini.
 *  The "Run" button always reconciles to this fixed actual (a scripted replay, never a random one). */
export const GOLDEN_USAGE: Usage = {
  inputTokens: 12000,
  cachedInputTokens: 8000,
  outputTokens: 800,
};

/** Mirrors the `windowKey()` spend-window bucket, packages/ai-meter/src/meter.ts - fixed here (no
 *  live clock in a deterministic replay); a real deploy buckets by UTC day/month instead. */
export const WINDOW_KEY = "sample-window";

/** Mirrors the ledger event types packages/ai-meter/src/meter.ts writes via @caisson/credits
 *  (eventType "feature_debit" | "feature_grant", feature = the registered "inference_call" tag). */
export type LedgerKind = "feature_debit" | "feature_grant";

export interface LedgerEntry {
  id: number;
  kind: LedgerKind;
  credits: number;
  reason: string;
}

interface PendingReserve {
  callId: string;
  model: ModelKey;
  reservedCredits: number;
  reconciled: boolean;
}

export interface MeterSession {
  wallet: number;
  hardCapCredits: number;
  softCapCredits: number;
  spentWindow: number;
  breaker: BreakerState;
  breakerReason: string | null;
  ledger: LedgerEntry[];
  callCounter: number;
  pendingReserve: PendingReserve | null;
}

/** A labeled sample starting wallet + caps - never a real balance, nothing persists past reload. */
export function initSession(
  startingWallet: number,
  hardCapCredits: number,
  softCapCredits: number,
): MeterSession {
  return {
    wallet: startingWallet,
    hardCapCredits,
    softCapCredits,
    spentWindow: 0,
    breaker: "closed",
    breakerReason: null,
    ledger: [],
    callCounter: 0,
    pendingReserve: null,
  };
}

export interface ReserveOutcome {
  reservedCredits: number;
  balance: number;
  spent: number;
  softExceeded: boolean;
  breakerTripped: boolean;
  windowKey: string;
  callId: string;
}

/** Mirrors reserve(), packages/ai-meter/src/meter.ts: the breaker is checked FIRST (open -> throw,
 *  nothing written); otherwise the estimate is debited from the wallet BEFORE any usage happens
 *  (debit-before-spend, ADR-0007), then the spend-window bump evaluates the caps and a crossed hard
 *  cap trips the breaker - this same reserve still succeeds, the NEXT one 402s. */
export function reserveStep(
  session: MeterSession,
  model: ModelKey,
  promptChars: number,
  maxOutputTokens?: number,
): { session: MeterSession; result: ReserveOutcome } {
  if (session.breaker === "open") {
    throw new SpendCapErrorMirror("account");
  }
  const entry = resolvePriceEntry(model);
  const usage = estimateUsage(
    [{ role: "user", content: "x".repeat(promptChars) }],
    maxOutputTokens,
  );
  const cost = computeCost(usage, entry);
  const callId = `call-${session.callCounter + 1}`;
  const wallet = session.wallet - cost.credits;
  const spentWindow = session.spentWindow + cost.credits;
  const breakerTripped = spentWindow >= session.hardCapCredits;
  const softExceeded = spentWindow >= session.softCapCredits;

  const ledgerEntry: LedgerEntry = {
    id: session.ledger.length + 1,
    kind: "feature_debit",
    credits: cost.credits,
    reason: `reserve ${callId}, debit before spend`,
  };

  const next: MeterSession = {
    ...session,
    wallet,
    spentWindow,
    breaker: breakerTripped ? "open" : session.breaker,
    breakerReason: breakerTripped
      ? "hard spend cap reached"
      : session.breakerReason,
    ledger: [ledgerEntry, ...session.ledger],
    callCounter: session.callCounter + 1,
    pendingReserve: {
      callId,
      model,
      reservedCredits: cost.credits,
      reconciled: false,
    },
  };

  return {
    session: next,
    result: {
      reservedCredits: cost.credits,
      balance: wallet,
      spent: spentWindow,
      softExceeded,
      breakerTripped,
      windowKey: WINDOW_KEY,
      callId,
    },
  };
}

export interface ReconcileOutcome {
  actualCredits: number;
  costMicroUsd: number;
  deltaCredits: number;
  refundedCredits: number;
  chargedCredits: number;
  balance: number;
  spent: number;
  softExceeded: boolean;
  breakerTripped: boolean;
  idempotent: boolean;
}

/** Mirrors reconcile(), packages/ai-meter/src/meter.ts: trues the reservation to the GOLDEN_USAGE
 *  actual - refunds an over-reservation (feature_grant), charges a shortfall (feature_debit), and
 *  settles a repeat call exactly once (the real usage_event's append-only UNIQUE(account, call_id) is
 *  the idempotency anchor there; `pendingReserve.reconciled` plays the same role here). Returns null
 *  when there is nothing pending - reconcile has nothing to true up against. */
export function reconcileStep(
  session: MeterSession,
): { session: MeterSession; result: ReconcileOutcome } | null {
  const pending = session.pendingReserve;
  if (pending === null) return null;

  const entry = resolvePriceEntry(pending.model);
  const actual = computeCost(GOLDEN_USAGE, entry);

  if (pending.reconciled) {
    return {
      session,
      result: {
        actualCredits: actual.credits,
        costMicroUsd: actual.costMicroUsd,
        deltaCredits: 0,
        refundedCredits: 0,
        chargedCredits: 0,
        balance: session.wallet,
        spent: session.spentWindow,
        softExceeded: session.spentWindow >= session.softCapCredits,
        breakerTripped: session.breaker === "open",
        idempotent: true,
      },
    };
  }

  const delta = actual.credits - pending.reservedCredits;
  const wallet = session.wallet - delta;
  const spentWindow = Math.max(0, session.spentWindow + delta);
  const breakerTripped = spentWindow >= session.hardCapCredits;
  const softExceeded = spentWindow >= session.softCapCredits;

  const ledgerEntries: LedgerEntry[] = [];
  if (delta > 0) {
    ledgerEntries.push({
      id: session.ledger.length + 1,
      kind: "feature_debit",
      credits: delta,
      reason: `reconcile ${pending.callId}, shortfall charged`,
    });
  } else if (delta < 0) {
    ledgerEntries.push({
      id: session.ledger.length + 1,
      kind: "feature_grant",
      credits: -delta,
      reason: `reconcile ${pending.callId}, over-reservation refunded`,
    });
  }

  const next: MeterSession = {
    ...session,
    wallet,
    spentWindow,
    breaker: breakerTripped ? "open" : session.breaker,
    breakerReason: breakerTripped
      ? "hard spend cap reached"
      : session.breakerReason,
    ledger: [...ledgerEntries, ...session.ledger],
    pendingReserve: { ...pending, reconciled: true },
  };

  return {
    session: next,
    result: {
      actualCredits: actual.credits,
      costMicroUsd: actual.costMicroUsd,
      deltaCredits: delta,
      refundedCredits: delta < 0 ? -delta : 0,
      chargedCredits: delta > 0 ? delta : 0,
      balance: wallet,
      spent: spentWindow,
      softExceeded,
      breakerTripped,
      idempotent: false,
    },
  };
}

export interface RunawayOutcome {
  trace: ReserveOutcome[];
  trippedAtIteration: number | null;
  blocked: { code: string; httpStatus: number; message: string } | null;
}

/** Bounded so a misconfigured cap can never loop this demo forever. */
const RUNAWAY_MAX_ITERATIONS = 12;

/** Fires repeated reserve()s back to back (a runaway retry loop, no reconcile between them) until the
 *  breaker trips, then one more pass to show the NEXT reserve blocked - the real reserve() 402s
 *  pre-call, the provider is never invoked (ADR-0060). */
export function runaway(
  session: MeterSession,
  model: ModelKey,
  promptChars: number,
  maxOutputTokens?: number,
): { session: MeterSession; outcome: RunawayOutcome } {
  let current = session;
  const trace: ReserveOutcome[] = [];
  let trippedAtIteration: number | null = null;
  let blocked: RunawayOutcome["blocked"] = null;

  for (let i = 1; i <= RUNAWAY_MAX_ITERATIONS; i++) {
    if (current.breaker === "open") {
      const err = new SpendCapErrorMirror("account");
      blocked = {
        code: err.code,
        httpStatus: err.httpStatus,
        message: err.message,
      };
      break;
    }
    const { session: next, result } = reserveStep(
      current,
      model,
      promptChars,
      maxOutputTokens,
    );
    current = next;
    trace.push(result);
    if (result.breakerTripped && trippedAtIteration === null) {
      trippedAtIteration = i;
    }
  }

  return { session: current, outcome: { trace, trippedAtIteration, blocked } };
}

/** Mirrors resetBreaker(), packages/ai-meter/src/breaker.ts (the operator path; fail-closed until
 *  called - a runaway loop cannot talk itself back open). */
export function resetBreakerStep(session: MeterSession): MeterSession {
  return { ...session, breaker: "closed", breakerReason: null };
}

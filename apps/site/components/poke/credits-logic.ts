// Deterministic client-side mirror of @caisson/credits' grant-and-debit ledger (ADR-0007/0023/0252)
// for the "credits" poke (ADR-0378 lock 2). The real grant()/debit() live in
// packages/credits/src/credits.ts and are DB-bound: they take a @caisson/tenancy-rls TenantExecutor,
// run SQL against credit_wallet / credit_event / grant_consumption, import node:crypto (randomUUID)
// and @caisson/jobs (advisory locks), and reach @caisson/kernel's barrel (node-only modules) for the
// branded Credits type. None of that resolves in a browser bundle, so the pure FIFO grant/debit math
// is mirrored here by hand and pinned in credits-logic.test.ts, which imports the real @caisson/credits
// + @caisson/kernel packages under bun and runs the REAL DB-bound debit() on PGlite (@caisson/testing),
// asserting this mirror's observable outcomes (balance-after + the typed 402) are identical.
//
// Integer credit units only (ADR-0007): every amount is a whole number, never a float. Nothing here
// fetches, persists, or measures anyone. The sample wallet is fixed and labeled sample.
//
// Sources mirrored: packages/credits/src/credits.ts (GRANT_EVENT_TYPES, DEBIT_EVENT_TYPES, the debit()
// FIFO walk + its 402 floor, assertPositiveInt), packages/kernel/src/errors.ts (InsufficientCreditsError
// code/httpStatus/message/details).

/**
 * Mirror of `GRANT_EVENT_TYPES` (packages/credits/src/credits.ts). The base-owned, base-closed set of
 * grant envelopes; `feature_grant` carries a registered feature tag (ADR-0074). Pinned identical to the
 * real constant in credits-logic.test.ts.
 */
export const GRANT_EVENT_TYPES = [
  "purchase",
  "sub_allotment",
  "topup",
  "feature_grant",
] as const;
export type GrantEventType = (typeof GRANT_EVENT_TYPES)[number];

/**
 * Mirror of `DEBIT_EVENT_TYPES` (packages/credits/src/credits.ts). Only the first three are
 * SPENDABLE-balance debits that route through `debit()` and can 402; `refund_clawback` / `expiry_debit`
 * are written via clawback()/sweepExpiredGrants() and never hit the 402 floor (documented in credits.ts).
 * Pinned identical to the real constant in the test.
 */
export const DEBIT_EVENT_TYPES = [
  "codegen_debit",
  "ai_feature_debit",
  "feature_debit",
  "refund_clawback",
  "expiry_debit",
] as const;
export type DebitEventType = (typeof DEBIT_EVENT_TYPES)[number];

/** The spendable-balance debit types the poke issues (each routes through the real `debit()` 402 floor). */
export type SpendableDebitType =
  "codegen_debit" | "ai_feature_debit" | "feature_debit";

/**
 * Mirror of `InsufficientCreditsError` (packages/kernel/src/errors.ts). The real class extends
 * CaissonError and carries `code`, `httpStatus`, and `details = { required, balance }`; this mirror
 * skips only the DB-facing envelope machinery (redaction allowlisting) this client-only replay never
 * needs. Byte-pinned against the real class in credits-logic.test.ts (same code, httpStatus 402,
 * default message, name, and details shape).
 */
export class InsufficientCreditsError extends Error {
  readonly code = "insufficient_credits";
  readonly httpStatus = 402;
  readonly details: { required: number; balance: number };
  constructor(
    required: number,
    balance: number,
    message = "Insufficient credits",
  ) {
    super(message);
    this.name = "InsufficientCreditsError";
    this.details = { required, balance };
  }
}

/** Mirror of `assertPositiveInt` (credits.ts): a grant/debit amount is a positive integer, else reject. */
export function assertPositiveInt(amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("amount must be a positive integer");
  }
}

/** One grant line in the wallet. `remaining = amount - consumed`; consumed only ever grows (append-only). */
export interface GrantLine {
  /** Stable display id (FIFO position label). Not a real UUID; the sample uses g1..gN. */
  readonly id: string;
  readonly eventType: GrantEventType;
  /** The registered feature tag for a `feature_grant` (ADR-0074); null for every other grant type. */
  readonly feature: string | null;
  /** Integer credits granted (ADR-0007). */
  readonly amount: number;
  /** Integer credits consumed by debits so far, derived FIFO. */
  readonly consumed: number;
}

/** One applied debit, recorded for the ledger view. */
export interface LedgerLine {
  readonly seq: number;
  readonly eventType: SpendableDebitType;
  /** Signed like the real credit_event.amount: negative for a debit. */
  readonly amount: number;
  /** Which grant lines this debit drew from, in FIFO order. */
  readonly consumption: readonly { grantId: string; taken: number }[];
  readonly balanceAfter: number;
}

export interface Wallet {
  readonly grants: readonly GrantLine[];
  readonly ledger: readonly LedgerLine[];
}

export function remaining(g: GrantLine): number {
  return g.amount - g.consumed;
}

/**
 * The spendable balance: the sum of unexpired grant remainders. In the real package this is the LOWER
 * of the FIFO-remaining sum and the wallet aggregate (spendableBalance, credits.ts); the two diverge
 * only after a clawback/expiry. This poke models neither, so the two floors coincide and the sum is
 * exact. The wallet is never negative (ADR-0007).
 */
export function balance(wallet: Wallet): number {
  return wallet.grants.reduce((sum, g) => sum + remaining(g), 0);
}

/** The sample wallet: four grant lines, one per GRANT_EVENT_TYPES member, integer credits. */
export const SAMPLE_GRANTS: readonly GrantLine[] = [
  { id: "g1", eventType: "purchase", feature: null, amount: 120, consumed: 0 },
  {
    id: "g2",
    eventType: "sub_allotment",
    feature: null,
    amount: 40,
    consumed: 0,
  },
  { id: "g3", eventType: "topup", feature: null, amount: 15, consumed: 0 },
  {
    id: "g4",
    eventType: "feature_grant",
    feature: "evidence_pack",
    amount: 25,
    consumed: 0,
  },
];

/** The freshly granted sample wallet (total 200 credits), no debits applied. */
export function initialWallet(): Wallet {
  return { grants: SAMPLE_GRANTS.map((g) => ({ ...g })), ledger: [] };
}

/**
 * Debit `amount` credits before the paid work (mirror of `debit()`, credits.ts). Walks the grant lines
 * in FIFO order (the real ORDER BY created_at, expires_at, id; here insertion order), consuming
 * min(remaining, toCover) from each. If the unexpired remainders cannot cover it, throws the typed
 * `InsufficientCreditsError(amount, available)` (the real 402 floor: `balance = amount - toCover` =
 * the covered portion = the spendable total) and records NOTHING (debit-before-spend). Otherwise the
 * consumption is applied and a ledger line appended.
 */
export function debit(
  wallet: Wallet,
  amount: number,
  eventType: SpendableDebitType,
): Wallet {
  assertPositiveInt(amount);
  const available = balance(wallet);
  if (amount > available) {
    // The whole transaction rolls back in the real package; here we simply return nothing and throw.
    throw new InsufficientCreditsError(amount, available);
  }

  let toCover = amount;
  const consumption: { grantId: string; taken: number }[] = [];
  const grants = wallet.grants.map((g) => {
    if (toCover === 0) return g;
    const take = Math.min(remaining(g), toCover);
    if (take === 0) return g;
    toCover -= take;
    consumption.push({ grantId: g.id, taken: take });
    return { ...g, consumed: g.consumed + take };
  });

  const balanceAfter = available - amount;
  const ledger: LedgerLine[] = [
    {
      seq: wallet.ledger.length + 1,
      eventType,
      amount: -amount,
      consumption,
      balanceAfter,
    },
    ...wallet.ledger,
  ];
  return { grants, ledger };
}

/** A debit preset the UI offers (fixed, deterministic). */
export interface DebitPreset {
  readonly amount: number;
  readonly eventType: SpendableDebitType;
  readonly label: string;
}

/**
 * The FIFO-drain presets. Every preset uses a tag-free spendable debit type (codegen_debit /
 * ai_feature_debit): the real `feature_debit` requires a registered feature tag (ADR-0074), so it is
 * kept out of the untagged preset row. Applied cumulatively to the current wallet, in any order they
 * drain the grant lines oldest-first.
 */
export const DEBIT_PRESETS: readonly DebitPreset[] = [
  { amount: 30, eventType: "codegen_debit", label: "codegen_debit 30" },
  { amount: 90, eventType: "ai_feature_debit", label: "ai_feature_debit 90" },
  { amount: 60, eventType: "codegen_debit", label: "codegen_debit 60" },
];

/** The break-it control: a debit larger than the full sample wallet, so it always 402s. */
export const OVERDRAW_PRESET: DebitPreset = {
  amount: 500,
  eventType: "codegen_debit",
  label: "codegen_debit 500",
};

export interface DebitOutcome {
  readonly wallet: Wallet;
  readonly ok: boolean;
  /** Set when the debit 402'd, the real typed error, unmodified. */
  readonly error: InsufficientCreditsError | null;
  readonly line: LedgerLine | null;
}

/**
 * Apply a debit, catching the typed 402 so the UI can render either the drained wallet or the failure.
 * On failure the wallet is returned UNCHANGED (nothing recorded), mirroring the real rollback.
 */
export function applyDebit(
  wallet: Wallet,
  amount: number,
  eventType: SpendableDebitType,
): DebitOutcome {
  try {
    const next = debit(wallet, amount, eventType);
    return {
      wallet: next,
      ok: true,
      error: null,
      line: next.ledger[0] ?? null,
    };
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return { wallet, ok: false, error: err, line: null };
    }
    throw err;
  }
}

/** The verdict line, computed from the outcome, never asserted copy. No em dashes (ADR-0375). */
export function verdictLine(outcome: DebitOutcome): {
  state: "ok" | "fail";
  text: string;
} {
  if (!outcome.ok || outcome.error !== null) {
    const e = outcome.error;
    const required = e?.details.required ?? 0;
    const bal = e?.details.balance ?? 0;
    return {
      state: "fail",
      text: `${e?.code ?? "insufficient_credits"} (${e?.httpStatus ?? 402}): required ${required}, balance ${bal}. Nothing recorded.`,
    };
  }
  const line = outcome.line;
  const drew = (line?.consumption ?? [])
    .map((c) => `${c.grantId} (${c.taken})`)
    .join(", ");
  const spent = line ? -line.amount : 0;
  return {
    state: "ok",
    text: `Debited ${spent} via ${line?.eventType ?? "codegen_debit"}. FIFO drew ${drew}. Balance ${line?.balanceAfter ?? 0}.`,
  };
}

"use client";

// The ai-meter module's flagship "poke" (ADR-0378 lock 2, kimi spec F3 "the breaker console"): a
// deterministic in-browser replay of the estimate -> reserve -> reconcile -> circuit-breaker money
// path, running on the REAL @caisson-sh/ai-meter (ADR-0396 — the hand-ported ai-meter-logic.ts mirror
// is deleted). Every number on screen comes from the package's own price book, estimator and cost
// normalizer via `@caisson-sh/ai-meter/browser`, and the blocked call throws the package's own
// SpendCapError.
//
// What stays poke-local, and why: reserve()/reconcile() themselves are async, take a
// `TenantExecutor`, and move a real credit wallet through @caisson-sh/credits — they cannot and must
// not run in a browser. `applyReserve`/`applyReconcile` below are a SAMPLE session ledger, not a
// second implementation of the money path: they hold demo state and delegate every credit figure to
// the package. The sample wallet, the fixed window key and the golden actual usage are demo data.
//
// No Date.now(), no Math.random(): the spend-window bucket is a fixed sample key and every call id
// is a session-scoped counter, so replaying the same click sequence always produces the same
// numbers. Nothing here fetches, persists, or measures the visitor.
import { useCallback, useState } from "react";
import {
  BUNDLED_PRICE_BOOK,
  CHARS_PER_TOKEN,
  CREDIT_CONVERSION,
  DEFAULT_SCOPE,
  PRICE_BOOK_VERSION,
  SpendCapError,
  computeCost,
  estimateUsage,
  resolvePriceEntry,
  type PriceBookEntry,
  type Usage,
} from "@caisson-sh/ai-meter/browser";

import { PokeShell, Verdict, type VerdictState } from "./poke-rig";
import styles from "./ai-meter-poke.module.css";

const STARTING_WALLET = 500;
const DEFAULT_HARD_CAP = 5;
const SOFT_CAP_RATIO = 0.6;
const DEFAULT_PROMPT_CHARS = 2000;

/** The selectable models ARE the real bundled book's keys — a row added upstream shows up here. */
export const MODEL_KEYS: readonly string[] = Object.keys(BUNDLED_PRICE_BOOK);

/**
 * The golden actual usage from packages/ai-meter/src/__golden__/cost.json ("openai-partial-cache").
 * The "Run" button always reconciles to this fixed actual — a scripted replay, never a random one.
 * Sample data: the poke test pins it against the shipped fixture.
 */
export const GOLDEN_USAGE: Usage = {
  inputTokens: 12000,
  cachedInputTokens: 8000,
  outputTokens: 800,
};

/** The spend-window bucket, fixed (no live clock in a deterministic replay). A real deploy buckets
 *  by UTC day/month instead — packages/ai-meter/src/meter.ts `windowKey()`. */
export const WINDOW_KEY = "sample-window";

/** Split a `provider/model` book key back into the pair `resolvePriceEntry` takes. The poke test
 *  pins the round trip through the package's own `priceKey`, so this is the real grammar. */
export function splitModelKey(key: string): {
  provider: string;
  model: string;
} {
  const slash = key.indexOf("/");
  if (slash < 0) return { provider: key, model: "" };
  return { provider: key.slice(0, slash), model: key.slice(slash + 1) };
}

/** The real fail-closed lookup: an unknown model throws `ConfigError`, never meters at zero. */
export function entryFor(key: string): PriceBookEntry {
  const { provider, model } = splitModelKey(key);
  return resolvePriceEntry(BUNDLED_PRICE_BOOK, provider, model);
}

function softCapFor(hardCap: number): number {
  return Math.max(1, Math.round(hardCap * SOFT_CAP_RATIO));
}

/** The ledger event types packages/ai-meter/src/meter.ts writes via @caisson-sh/credits. */
export type LedgerKind = "feature_debit" | "feature_grant";

export interface LedgerEntry {
  id: number;
  kind: LedgerKind;
  credits: number;
  reason: string;
}

interface PendingReserve {
  callId: string;
  model: string;
  reservedCredits: number;
  reconciled: boolean;
}

export interface MeterSession {
  wallet: number;
  hardCapCredits: number;
  softCapCredits: number;
  spentWindow: number;
  breaker: "closed" | "open";
  breakerReason: string | null;
  ledger: LedgerEntry[];
  callCounter: number;
  pendingReserve: PendingReserve | null;
}

/** A labeled sample starting wallet + caps — never a real balance, nothing persists past reload. */
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

/**
 * The sample-ledger side of reserve(), mirroring the ORDER packages/ai-meter/src/meter.ts uses: the
 * breaker is checked FIRST (open -> the package's own SpendCapError, nothing written); the estimate
 * is debited BEFORE any usage happens (debit-before-spend, ADR-0007); then the spend-window bump
 * evaluates the caps and a crossed hard cap trips the breaker — this same reserve still succeeds,
 * the NEXT one 402s. Every credit figure comes from the package: real estimateUsage, real
 * computeCost, real conversion.
 */
export function applyReserve(
  session: MeterSession,
  model: string,
  promptChars: number,
  maxOutputTokens?: number,
): { session: MeterSession; result: ReserveOutcome } {
  if (session.breaker === "open") {
    throw new SpendCapError(DEFAULT_SCOPE);
  }
  const usage = estimateUsage(
    [{ role: "user", content: "x".repeat(promptChars) }],
    maxOutputTokens,
  );
  const cost = computeCost(usage, entryFor(model), CREDIT_CONVERSION);
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

/**
 * The sample-ledger side of reconcile(): trues the reservation to the GOLDEN_USAGE actual — refunds
 * an over-reservation (feature_grant), charges a shortfall (feature_debit), and settles a repeat
 * call exactly once. In the package the append-only `usage_event` UNIQUE (account, call_id) is the
 * idempotency anchor; `pendingReserve.reconciled` plays that role here. Returns null when there is
 * nothing pending — reconcile has nothing to true up against.
 */
export function applyReconcile(
  session: MeterSession,
): { session: MeterSession; result: ReconcileOutcome } | null {
  const pending = session.pendingReserve;
  if (pending === null) return null;

  const actual = computeCost(
    GOLDEN_USAGE,
    entryFor(pending.model),
    CREDIT_CONVERSION,
  );

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

/** Fires repeated reserves back to back (a runaway retry loop, no reconcile between them) until the
 *  breaker trips, then one more pass to show the NEXT reserve blocked — the real reserve() 402s
 *  pre-call and the provider is never invoked (ADR-0060). */
export function runaway(
  session: MeterSession,
  model: string,
  promptChars: number,
  maxOutputTokens?: number,
): { session: MeterSession; outcome: RunawayOutcome } {
  let current = session;
  const trace: ReserveOutcome[] = [];
  let trippedAtIteration: number | null = null;
  let blocked: RunawayOutcome["blocked"] = null;

  for (let i = 1; i <= RUNAWAY_MAX_ITERATIONS; i++) {
    if (current.breaker === "open") {
      const err = new SpendCapError(DEFAULT_SCOPE);
      blocked = {
        code: err.code,
        httpStatus: err.httpStatus,
        message: err.message,
      };
      break;
    }
    const { session: next, result } = applyReserve(
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

/** The operator path (packages/ai-meter/src/breaker.ts `resetBreaker`), fail-closed until called —
 *  a runaway loop cannot talk itself back open. */
export function applyResetBreaker(session: MeterSession): MeterSession {
  return { ...session, breaker: "closed", breakerReason: null };
}

interface VerdictLine {
  state: VerdictState;
  message: string;
}

export default function AiMeterPoke() {
  const [model, setModel] = useState<string>(
    MODEL_KEYS[0] ?? "openai/gpt-4o-mini",
  );
  const [promptChars, setPromptChars] = useState(DEFAULT_PROMPT_CHARS);
  const [session, setSession] = useState<MeterSession>(() =>
    initSession(
      STARTING_WALLET,
      DEFAULT_HARD_CAP,
      softCapFor(DEFAULT_HARD_CAP),
    ),
  );
  const [verdict, setVerdict] = useState<VerdictLine>({
    state: "neutral",
    message: "Configure a run, then reserve.",
  });

  const handleHardCapChange = useCallback((value: number) => {
    const hardCap = Math.min(50, Math.max(1, value));
    setSession((s) => ({
      ...s,
      hardCapCredits: hardCap,
      softCapCredits: softCapFor(hardCap),
    }));
  }, []);

  const handleReserve = useCallback(() => {
    try {
      const { session: next, result } = applyReserve(
        session,
        model,
        promptChars,
      );
      setSession(next);
      setVerdict({
        state: result.breakerTripped ? "fail" : "ok",
        message: result.breakerTripped
          ? `Reserved ${result.reservedCredits} credits. Hard cap crossed, breaker open.`
          : `Reserved ${result.reservedCredits} credits. Balance ${result.balance}.`,
      });
    } catch (err) {
      if (err instanceof SpendCapError) {
        setVerdict({ state: "fail", message: `Blocked. ${err.message}` });
        return;
      }
      throw err;
    }
  }, [session, model, promptChars]);

  const handleRun = useCallback(() => {
    const outcome = applyReconcile(session);
    if (outcome === null) {
      setVerdict({ state: "neutral", message: "Reserve first, then run." });
      return;
    }
    const { session: next, result } = outcome;
    setSession(next);
    if (result.idempotent) {
      setVerdict({ state: "ok", message: "Already reconciled. Settled once." });
    } else if (result.chargedCredits > 0) {
      setVerdict({
        state: "ok",
        message: `Reconciled. Charged ${result.chargedCredits} more credits.`,
      });
    } else if (result.refundedCredits > 0) {
      setVerdict({
        state: "ok",
        message: `Reconciled. Refunded ${result.refundedCredits} credits.`,
      });
    } else {
      setVerdict({ state: "ok", message: "Reconciled. No delta." });
    }
  }, [session]);

  const handleRunaway = useCallback(() => {
    const { session: next, outcome } = runaway(session, model, promptChars);
    setSession(next);
    if (outcome.blocked !== null) {
      setVerdict({
        state: "fail",
        message: `Breaker open after ${outcome.trippedAtIteration} reserves. Next call: ${outcome.blocked.httpStatus} ${outcome.blocked.code}.`,
      });
    } else {
      setVerdict({
        state: "neutral",
        message: `${outcome.trace.length} reserves ran clean. Cap not crossed.`,
      });
    }
  }, [session, model, promptChars]);

  const handleReset = useCallback(() => {
    setSession((s) => applyResetBreaker(s));
    setVerdict({ state: "ok", message: "Breaker closed. Reserves resume." });
  }, []);

  return (
    <PokeShell
      label={`@caisson-sh/ai-meter · price book ${PRICE_BOOK_VERSION}`}
      title="Reserve before you spend. Reconcile to the cent. Trip before the invoice."
    >
      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Model</span>
          <select
            className={styles.select}
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {MODEL_KEYS.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            Prompt size, sample. ~{Math.ceil(promptChars / CHARS_PER_TOKEN)}{" "}
            tokens
          </span>
          <input
            className={styles.range}
            type="range"
            min={0}
            max={8000}
            step={200}
            value={promptChars}
            onChange={(e) => setPromptChars(Number(e.target.value))}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Hard cap, credits</span>
          <input
            className={styles.number}
            type="number"
            min={1}
            max={50}
            step={1}
            value={session.hardCapCredits}
            onChange={(e) => handleHardCapChange(Number(e.target.value))}
          />
        </label>
      </div>

      <div className={styles.stats}>
        <span>
          Wallet <strong>{session.wallet}</strong>
        </span>
        <span>
          Spent this window <strong>{session.spentWindow}</strong> /{" "}
          {session.hardCapCredits}
        </span>
        <span className={styles.breaker} data-state={session.breaker}>
          <span className={styles.breakerLamp} aria-hidden="true" />
          Breaker {session.breaker}
        </span>
        {session.breaker === "closed" &&
        session.spentWindow >= session.softCapCredits ? (
          <span className={styles.soft}>Soft cap crossed</span>
        ) : null}
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={handleReserve}>
          Reserve
        </button>
        <button type="button" className={styles.button} onClick={handleRun}>
          Run
        </button>
        <button type="button" className={styles.button} onClick={handleRunaway}>
          Runaway loop
        </button>
        <button
          type="button"
          className={styles.buttonGhost}
          onClick={handleReset}
        >
          Reset breaker
        </button>
      </div>

      <ul className={styles.ledger}>
        {session.ledger.length === 0 ? (
          <li className={styles.ledgerEmpty}>No ledger rows yet.</li>
        ) : (
          session.ledger.slice(0, 6).map((entry) => (
            <li
              key={entry.id}
              className={styles.ledgerRow}
              data-kind={entry.kind}
            >
              <span className={styles.ledgerKind}>
                {entry.kind === "feature_debit" ? "DEBIT" : "GRANT"}
              </span>
              <span className={styles.ledgerCredits}>{entry.credits} cr</span>
              <span className={styles.ledgerReason}>{entry.reason}</span>
            </li>
          ))
        )}
      </ul>

      <Verdict state={verdict.state}>{verdict.message}</Verdict>
    </PokeShell>
  );
}

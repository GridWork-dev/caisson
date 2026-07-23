"use client";

// The ai-meter module's flagship "poke" (ADR-0378 lock 2, kimi spec F3 "the breaker console"). A
// deterministic in-browser replay of the estimate -> reserve -> reconcile -> circuit-breaker money
// path (packages/ai-meter/src/meter.ts + breaker.ts), running on the package's REAL pure math
// (mirrored in ./ai-meter-logic.ts, golden-pinned against the real package in
// ./ai-meter-logic.test.ts - see that file's header for why the mirror exists instead of a direct
// import). Nothing here fetches, persists, or measures the visitor.
import { useCallback, useState } from "react";

import { PokeShell, Verdict, type VerdictState } from "./poke-rig";
import {
  CHARS_PER_TOKEN,
  MODEL_KEYS,
  PRICE_BOOK_VERSION,
  SpendCapErrorMirror,
  initSession,
  reconcileStep,
  reserveStep,
  resetBreakerStep,
  runaway,
  type MeterSession,
  type ModelKey,
} from "./ai-meter-logic";
import styles from "./ai-meter-poke.module.css";

const STARTING_WALLET = 500;
const DEFAULT_HARD_CAP = 5;
const SOFT_CAP_RATIO = 0.6;
const DEFAULT_PROMPT_CHARS = 2000;

function softCapFor(hardCap: number): number {
  return Math.max(1, Math.round(hardCap * SOFT_CAP_RATIO));
}

interface VerdictLine {
  state: VerdictState;
  message: string;
}

export default function AiMeterPoke() {
  const [model, setModel] = useState<ModelKey>(
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
      const { session: next, result } = reserveStep(
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
      if (err instanceof SpendCapErrorMirror) {
        setVerdict({ state: "fail", message: `Blocked. ${err.message}` });
        return;
      }
      throw err;
    }
  }, [session, model, promptChars]);

  const handleRun = useCallback(() => {
    const outcome = reconcileStep(session);
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
    setSession((s) => resetBreakerStep(s));
    setVerdict({ state: "ok", message: "Breaker closed. Reserves resume." });
  }, []);

  return (
    <PokeShell
      label={`@caisson/ai-meter · price book ${PRICE_BOOK_VERSION}`}
      title="Reserve before you spend. Reconcile to the cent. Trip before the invoice."
    >
      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Model</span>
          <select
            className={styles.select}
            value={model}
            onChange={(e) => setModel(e.target.value as ModelKey)}
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

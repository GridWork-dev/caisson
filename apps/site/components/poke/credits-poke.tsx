"use client";

// Flagship poke for @caisson/credits (ADR-0378 lock 2). A grant-and-debit ledger lab: four sample
// grant lines typed by GRANT_EVENT_TYPES, and a debit that walks them FIFO (oldest grant first),
// draining each line's remaining credits. Overdraw the wallet and the debit throws the real typed
// InsufficientCreditsError (code insufficient_credits, httpStatus 402, details { required, balance })
// and records nothing, debit-before-spend. Integer credit units only (ADR-0007). All math is the
// pure mirror in credits-logic.ts, golden-pinned against the real DB-bound debit() in
// credits-logic.test.ts. Nothing leaves the page.
import { useState } from "react";

import { PokeShell, Verdict } from "./poke-rig";
import styles from "./credits-poke.module.css";
import {
  applyDebit,
  balance,
  DEBIT_PRESETS,
  initialWallet,
  OVERDRAW_PRESET,
  remaining,
  SAMPLE_GRANTS,
  verdictLine,
  type DebitOutcome,
  type DebitPreset,
  type Wallet,
} from "./credits-logic";

const TITLE =
  "Debit this wallet FIFO, then overdraw it and read the typed 402.";
const TOTAL_GRANTED = SAMPLE_GRANTS.reduce((sum, g) => sum + g.amount, 0);

export default function CreditsPoke() {
  const [wallet, setWallet] = useState<Wallet>(() => initialWallet());
  const [outcome, setOutcome] = useState<DebitOutcome | null>(null);

  function onDebit(preset: DebitPreset) {
    const next = applyDebit(wallet, preset.amount, preset.eventType);
    setOutcome(next);
    setWallet(next.wallet); // unchanged reference on a failed (402) debit
  }

  function onReset() {
    setWallet(initialWallet());
    setOutcome(null);
  }

  const spendable = balance(wallet);
  const line = outcome ? verdictLine(outcome) : null;

  return (
    <PokeShell label="@caisson/credits" title={TITLE}>
      <ol className={styles.grants}>
        {wallet.grants.map((g) => {
          const rem = remaining(g);
          const pct = g.amount === 0 ? 0 : Math.round((rem / g.amount) * 100);
          return (
            <li
              key={g.id}
              className={styles.grant}
              data-tone={rem === 0 ? "drained" : "live"}
            >
              <span className={styles.grantType}>{g.eventType}</span>
              {g.feature !== null ? (
                <span className={styles.feature}>{g.feature}</span>
              ) : (
                <span className={styles.featureNone} aria-hidden="true" />
              )}
              <span className={styles.bar} aria-hidden="true">
                <span
                  className={styles.barFill}
                  style={{ inlineSize: `${pct}%` }}
                />
              </span>
              <span className={styles.amount}>
                <strong>{rem}</strong> / {g.amount}
              </span>
            </li>
          );
        })}
      </ol>

      <dl className={styles.wallet}>
        <div className={styles.walletCell}>
          <dt>Spendable</dt>
          <dd data-tone={spendable === 0 ? "empty" : "live"}>{spendable}</dd>
        </div>
        <div className={styles.walletCell}>
          <dt>Granted</dt>
          <dd>{TOTAL_GRANTED}</dd>
        </div>
        <div className={styles.walletCell}>
          <dt>Spent</dt>
          <dd>{TOTAL_GRANTED - spendable}</dd>
        </div>
      </dl>

      <div className={styles.controls}>
        {DEBIT_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={styles.action}
            onClick={() => onDebit(preset)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.overdraw}
          onClick={() => onDebit(OVERDRAW_PRESET)}
        >
          Overdraw {OVERDRAW_PRESET.amount}
        </button>
        <button type="button" className={styles.reset} onClick={onReset}>
          Re-grant sample
        </button>
      </div>

      {wallet.ledger.length > 0 ? (
        <ol className={styles.ledger}>
          {wallet.ledger.slice(0, 4).map((entry) => (
            <li key={entry.seq} className={styles.ledgerRow}>
              <span className={styles.ledgerType}>{entry.eventType}</span>
              <span className={styles.ledgerAmount}>{entry.amount}</span>
              <span className={styles.ledgerTrace}>
                {entry.consumption
                  .map((c) => `${c.grantId}(${c.taken})`)
                  .join(" ")}
              </span>
              <span className={styles.ledgerBalance}>
                = {entry.balanceAfter}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {line !== null ? (
        <Verdict state={line.state}>{line.text}</Verdict>
      ) : (
        <Verdict state="neutral">
          Sample wallet: {TOTAL_GRANTED} credits across {SAMPLE_GRANTS.length}{" "}
          grant lines. Debit to walk them FIFO.
        </Verdict>
      )}
    </PokeShell>
  );
}

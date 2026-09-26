"use client";

// Flagship poke for @caisson-sh/credits (ADR-0378 lock 2, retired against the real package by
// ADR-0396). A grant-and-debit ledger lab: four sample grant lines typed by the package's own
// GRANT_EVENT_TYPES, and a debit that walks them FIFO (oldest grant first), draining each line's
// remaining credits. Overdraw the wallet and the debit reports the real typed
// InsufficientCreditsError (code insufficient_credits, httpStatus 402, details { required,
// balance }) and records nothing, debit-before-spend. Integer credit units only (ADR-0007).
//
// The FIFO waterfall and the covered/shortfall split are the REAL package's `planFifoDebit`
// (@caisson-sh/credits/browser) — the same function the server's DB-bound `debit()` walks, so this
// demo cannot show a draw or a 402 the real ledger would not compute. What stays local here is
// sample data and presentation: the fixed sample wallet, the in-memory grant/ledger view model,
// and the verdict copy. The database half (grant/debit/clawback, the sweeps, the schema) is
// server-only and deliberately absent. Nothing leaves the page.
import { useState } from "react";
import { planFifoDebit, type FifoDraw } from "@caisson-sh/credits/browser";
import { InsufficientCreditsError } from "@caisson-sh/kernel";

import { PokeShell, Verdict } from "./poke-rig";
import styles from "./credits-poke.module.css";

/** One grant line in the sample wallet. `remaining = amount - consumed`; consumed only ever grows. */
export interface GrantLine {
  /** Stable display id (FIFO position label). Not a real UUID; the sample uses g1..gN. */
  readonly id: string;
  /** A member of the package's GRANT_EVENT_TYPES (pinned in the poke test). */
  readonly eventType: string;
  /** The registered feature tag for a `feature_grant` (ADR-0074); null for every other grant type. */
  readonly feature: string | null;
  /** Integer credits granted (ADR-0007). */
  readonly amount: number;
  /** Integer credits consumed by debits so far, attributed FIFO by the real planner. */
  readonly consumed: number;
}

/** The spendable-balance debit types the poke issues. `feature_debit` needs a registered feature
 *  tag (ADR-0074), so the untagged preset row stays on the two tag-free types. */
export type SpendableDebitType = "codegen_debit" | "ai_feature_debit";

/** One applied debit, recorded for the ledger view. */
export interface LedgerLine {
  readonly seq: number;
  readonly eventType: SpendableDebitType;
  /** Signed like the real credit_event.amount: negative for a debit. */
  readonly amount: number;
  /** Which grant lines this debit drew from, straight off the package's plan. */
  readonly draws: readonly FifoDraw[];
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
 * The spendable balance shown in the header: the sum of the sample wallet's grant remainders. The
 * real `spendableBalance()` takes the LOWER of that FIFO sum and the wallet aggregate; the two
 * diverge only after a clawback or an unswept expiry, neither of which this sample models, so the
 * floors coincide here. The wallet is never negative (ADR-0007).
 */
export function walletBalance(wallet: Wallet): number {
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

export interface DebitOutcome {
  readonly wallet: Wallet;
  readonly ok: boolean;
  /** Set when the debit 402'd — the real kernel error, constructed from the plan's own numbers. */
  readonly error: InsufficientCreditsError | null;
  readonly line: LedgerLine | null;
}

/**
 * Apply a debit to the sample wallet through the package's real FIFO planner, catching the 402 so
 * the UI can render either the drained wallet or the failure.
 *
 * The order mirrors the server: plan first, then decide. A shortfall means the wallet is returned
 * UNCHANGED with the typed `InsufficientCreditsError(amount, plan.covered)` — the same arguments
 * the server throws after rolling its transaction back, so the required/balance pair a buyer reads
 * here is the pair the API would return.
 */
export function applyDebit(
  wallet: Wallet,
  amount: number,
  eventType: SpendableDebitType,
): DebitOutcome {
  const plan = planFifoDebit(
    wallet.grants.map((g) => ({ id: g.id, remaining: remaining(g) })),
    amount,
  );
  // Negated form, matching the server's own 402 gate: anything not provably covered in full fails
  // the debit (`shortfall > 0` would read false for a NaN shortfall and render it as succeeded).
  if (!(plan.shortfall <= 0)) {
    return {
      wallet,
      ok: false,
      error: new InsufficientCreditsError(amount, plan.covered),
      line: null,
    };
  }
  const takenByGrant = new Map(plan.draws.map((d) => [d.grantId, d.taken]));
  const grants = wallet.grants.map((g) => {
    const taken = takenByGrant.get(g.id);
    return taken === undefined ? g : { ...g, consumed: g.consumed + taken };
  });
  const line: LedgerLine = {
    seq: wallet.ledger.length + 1,
    eventType,
    amount: -amount,
    draws: plan.draws,
    balanceAfter: grants.reduce((sum, g) => sum + remaining(g), 0),
  };
  return {
    wallet: { grants, ledger: [line, ...wallet.ledger] },
    ok: true,
    error: null,
    line,
  };
}

/** A debit preset the UI offers (fixed, deterministic). */
export interface DebitPreset {
  readonly amount: number;
  readonly eventType: SpendableDebitType;
  readonly label: string;
}

/** The FIFO-drain presets, applied cumulatively; in any order they drain the lines oldest-first. */
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

/** Read an integer off the kernel error's redaction-safe `details` bag without widening a type. */
function creditDetail(
  e: InsufficientCreditsError,
  key: "required" | "balance",
): number {
  const value = e.details?.[key];
  return typeof value === "number" ? value : 0;
}

/** The verdict line, computed from the outcome, never asserted copy. No em dashes (ADR-0375). */
export function verdictLine(outcome: DebitOutcome): {
  state: "ok" | "fail";
  text: string;
} {
  const e = outcome.error;
  if (!outcome.ok || e !== null) {
    if (e === null) {
      return { state: "fail", text: "Debit rejected. Nothing recorded." };
    }
    return {
      state: "fail",
      text: `${e.code} (${e.httpStatus}): required ${creditDetail(e, "required")}, balance ${creditDetail(e, "balance")}. Nothing recorded.`,
    };
  }
  const line = outcome.line;
  const drew = (line?.draws ?? [])
    .map((d) => `${d.grantId} (${d.taken})`)
    .join(", ");
  const spent = line ? -line.amount : 0;
  return {
    state: "ok",
    text: `Debited ${spent} via ${line?.eventType ?? "codegen_debit"}. FIFO drew ${drew}. Balance ${line?.balanceAfter ?? 0}.`,
  };
}

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

  const spendable = walletBalance(wallet);
  const line = outcome ? verdictLine(outcome) : null;

  return (
    <PokeShell label="@caisson-sh/credits" title={TITLE}>
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
                {entry.draws.map((d) => `${d.grantId}(${d.taken})`).join(" ")}
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

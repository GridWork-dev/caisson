"use client";

// Flagship F2 "Break the chain" (ADR-0378 lock 2). A real SHA-256 audit chain, computed live in the
// browser over WebCrypto (audit-worm-logic.ts — the @caisson/kernel chain mirrored, golden-pinned in
// audit-worm-logic.test.ts). Append entries, tamper a historical row and watch every link after it
// break, or cut the tail and watch the trusted anchor catch it. Nothing leaves the page.
import { useCallback, useEffect, useState } from "react";

import { PokeShell, Verdict } from "./poke-rig";
import styles from "./audit-worm-poke.module.css";
import {
  appendEntry,
  cutTail,
  evaluate,
  eventName,
  formatDate,
  initialState,
  MAX_ENTRIES,
  retainUntil,
  shortHash,
  tamperRow,
  verdictLine,
  type ChainState,
  type RetentionMode,
  type Verdict as ChainVerdict,
} from "./audit-worm-logic";

const RETAIN_UNTIL = formatDate(retainUntil());

// 7-year term (DEFAULT_RETENTION_YEARS) above the 6-year WORM floor (MIN_RETENTION_YEARS), retain.ts.
const RETAIN_TERM_LABEL = "7yr term, 6yr floor";

const MODE_NOTE: Record<RetentionMode, string> = {
  GOVERNANCE: "Bypassable by a caller holding s3:BypassGovernanceRetention.",
  COMPLIANCE: "Root-proof. This data cannot be deleted before the date.",
};

const ROW_TONE: Record<string, string> = {
  "Chain root": "root",
  Verified: "ok",
  Tampered: "fail",
};

export default function AuditWormPoke() {
  const [state, setState] = useState<ChainState | null>(null);
  const [verdict, setVerdict] = useState<ChainVerdict | null>(null);
  const [mode, setMode] = useState<RetentionMode>("GOVERNANCE");

  const commit = useCallback(async (next: ChainState) => {
    setState(next);
    setVerdict(await evaluate(next));
  }, []);

  useEffect(() => {
    void initialState().then(commit);
  }, [commit]);

  const onReset = useCallback(() => {
    void initialState().then(commit);
  }, [commit]);

  if (state === null || verdict === null) {
    return (
      <PokeShell
        label="@caisson/audit-worm"
        title="Append. Anchor. Then edit history and watch the verdict flip."
      >
        <p className={styles.loading}>Sealing the chain…</p>
      </PokeShell>
    );
  }

  const line = verdictLine(verdict, state);
  const atMax = state.entries.length >= MAX_ENTRIES;

  return (
    <PokeShell
      label="@caisson/audit-worm"
      title="Append. Anchor. Then edit history and watch the verdict flip."
    >
      <ol className={styles.chain}>
        {state.entries.map((entry, i) => {
          const label = verdict.rows[i] ?? "Verified";
          return (
            <li
              key={entry.seq}
              className={styles.row}
              data-tone={ROW_TONE[label]}
            >
              <span className={styles.seq}>#{entry.seq}</span>
              <span className={styles.event}>{eventName(entry.payload)}</span>
              <code className={styles.hash}>{shortHash(entry.hash)}</code>
              <span className={styles.rowState} data-tone={ROW_TONE[label]}>
                {label}
              </span>
              <button
                type="button"
                className={styles.tamper}
                onClick={() => void commit(tamperRow(state, i))}
              >
                Tamper
              </button>
            </li>
          );
        })}
      </ol>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.action}
          onClick={() => void appendEntry(state).then(commit)}
          disabled={atMax}
        >
          Append entry
        </button>
        <button
          type="button"
          className={styles.action}
          onClick={() => void commit(cutTail(state))}
          disabled={state.entries.length <= 1}
        >
          Cut the tail
        </button>
        <button type="button" className={styles.action} onClick={onReset}>
          Re-seal
        </button>
      </div>

      <div className={styles.anchor}>
        <div className={styles.anchorHead}>
          <span className={styles.anchorTitle}>Anchor</span>
          <span
            className={styles.anchorState}
            data-tone={
              verdict.lengthMatches && verdict.tipMatches ? "ok" : "fail"
            }
          >
            {verdict.lengthMatches && verdict.tipMatches ? "Holds" : "Failed"}
          </span>
        </div>
        <dl className={styles.anchorGrid}>
          <dt>length</dt>
          <dd data-tone={verdict.lengthMatches ? "ok" : "fail"}>
            {state.anchor.length}
            {verdict.lengthMatches ? "" : ` (${state.entries.length} present)`}
          </dd>
          <dt>tipHash</dt>
          <dd>
            <code>{shortHash(state.anchor.tipHash)}</code>
          </dd>
          <dt>genesisHash</dt>
          <dd>
            <code>
              {state.anchor.genesisHash
                ? shortHash(state.anchor.genesisHash)
                : "none"}
            </code>
          </dd>
        </dl>

        <div className={styles.retain}>
          <div
            className={styles.modeToggle}
            role="group"
            aria-label="Retention mode"
          >
            {(["GOVERNANCE", "COMPLIANCE"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={styles.modeButton}
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <p className={styles.retainLine}>
            Retain until <strong>{RETAIN_UNTIL}</strong> ({RETAIN_TERM_LABEL})
          </p>
          <p className={styles.modeNote}>{MODE_NOTE[mode]}</p>
        </div>
      </div>

      <Verdict state={line.state}>{line.text}</Verdict>
    </PokeShell>
  );
}

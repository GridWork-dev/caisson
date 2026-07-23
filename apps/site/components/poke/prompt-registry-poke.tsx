"use client";

// Flagship "Alias mover" poke for @caisson/prompt-registry (ADR-0378 lock 2). Four immutable
// version rows on a fixed sample prompt, append-only, never mutated or removed. `prod` is the ONE
// mutable pointer: promote it forward, roll it back, or try pointing it at a version that was never
// minted and watch the write get rejected before it happens. Every attempt appends to the move log
// below, whether it moved the pointer or not. All math is the pure mirror in prompt-registry-logic.ts,
// golden-pinned against the real DB-bound registerPrompt()/setAlias() in
// prompt-registry-logic.test.ts. Nothing leaves the page.
import { useState } from "react";

import { PokeShell, Verdict } from "./poke-rig";
import styles from "./prompt-registry-poke.module.css";
import {
  aliasVersion,
  currentTipVersion,
  initialState,
  moveAlias,
  SAMPLE_NAME,
  SAMPLE_VERSIONS,
  verdictLine,
  type RegistryState,
} from "./prompt-registry-logic";

const TITLE =
  "Promote the alias pointer, then try moving it somewhere that never shipped.";

/** The lineage tip is derived, not stored (kernel currentVersions) — computed once, it never changes. */
const TIP_VERSION = currentTipVersion();

/** The deny-path control: this version was never minted, so pointing prod here always fails closed. */
const NEVER_MINTED_VERSION = 9;

/** Cap the visible log so the strip stays readable; the full history stays in state regardless. */
const LOG_VISIBLE = 6;

export default function PromptRegistryPoke() {
  const [state, setState] = useState<RegistryState>(() => initialState());

  const prod = aliasVersion(state);
  const line = verdictLine(state);

  function move(targetVersion: number) {
    setState((s) => moveAlias(s, targetVersion));
  }

  function onReset() {
    setState(initialState());
  }

  return (
    <PokeShell label="@caisson/prompt-registry" title={TITLE}>
      <p className={styles.name}>
        <code>{SAMPLE_NAME}</code>
        <span className={styles.sampleTag}>sample</span>
      </p>

      <ol className={styles.versions}>
        {SAMPLE_VERSIONS.map((v) => {
          const isProd = v.version === prod;
          const isTip = v.version === TIP_VERSION;
          return (
            <li
              key={v.id}
              className={styles.row}
              data-tone={isProd ? "prod" : "plain"}
            >
              <span className={styles.version}>v{v.version}</span>
              <span className={styles.summary}>{v.summary}</span>
              <span className={styles.badges}>
                {isTip ? (
                  <span className={styles.badgeTip}>current tip</span>
                ) : null}
                {isProd ? <span className={styles.badgeProd}>prod</span> : null}
              </span>
              <button
                type="button"
                className={styles.point}
                onClick={() => move(v.version)}
                disabled={isProd}
              >
                Point prod here
              </button>
            </li>
          );
        })}
      </ol>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.deny}
          onClick={() => move(NEVER_MINTED_VERSION)}
        >
          Point prod at v{NEVER_MINTED_VERSION} (never minted)
        </button>
        <button type="button" className={styles.reset} onClick={onReset}>
          Reset
        </button>
      </div>

      {state.moveLog.length > 0 ? (
        <ol className={styles.log}>
          {state.moveLog.slice(0, LOG_VISIBLE).map((entry) => (
            <li
              key={entry.seq}
              className={styles.logRow}
              data-tone={entry.ok ? "ok" : "fail"}
            >
              <span className={styles.logSeq}>#{entry.seq}</span>
              <span className={styles.logMove}>
                prod v{entry.fromVersion} <span aria-hidden="true">&rarr;</span>{" "}
                v{entry.targetVersion}
              </span>
              <span className={styles.logState}>
                {entry.ok ? "moved" : "denied"}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.logEmpty}>
          No moves yet. Every attempt below appends here, moved or denied.
        </p>
      )}

      <Verdict state={line.state}>{line.text}</Verdict>
    </PokeShell>
  );
}

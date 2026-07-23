"use client";

// The agent-kernel module's flagship "poke" (ADR-0378 lock 2, kimi spec: "agent-kernel: click
// transitions across ACTS, canTransition verdicts, a failed VERIFY reopens PLAN, an illegal skip
// throws"). A deterministic in-browser replay of the lifecycle act FSM
// (packages/agent-kernel/src/lifecycle.ts), running on the package's REAL transition table
// (mirrored in ./agent-kernel-logic.ts, golden-pinned against the real package in
// ./agent-kernel-logic.test.ts - see that file's header for why the mirror exists instead of a
// direct import). Nothing here fetches, persists, or measures the visitor.
import { useCallback, useState } from "react";

import { PokeShell, Verdict, type VerdictState } from "./poke-rig";
import {
  ACTS,
  ValidationErrorMirror,
  attemptTransition,
  canTransition,
  initLifecycleSession,
  isTerminal,
  type Act,
  type LifecycleSession,
} from "./agent-kernel-logic";
import styles from "./agent-kernel-poke.module.css";

interface VerdictLine {
  state: VerdictState;
  message: string;
}

const INITIAL_VERDICT: VerdictLine = {
  state: "neutral",
  message: "Click an act to attempt a transition from spec.",
};

export default function AgentKernelPoke() {
  const [session, setSession] =
    useState<LifecycleSession>(initLifecycleSession);
  const [verdict, setVerdict] = useState<VerdictLine>(INITIAL_VERDICT);

  const handleClickAct = useCallback(
    (to: Act) => {
      if (to === session.current) return;
      try {
        const { session: next, step } = attemptTransition(session, to);
        setSession(next);
        setVerdict({
          state: "ok",
          message: `Legal transition. ${step.from} → ${step.to}.`,
        });
      } catch (err) {
        if (err instanceof ValidationErrorMirror) {
          setVerdict({
            state: "fail",
            message: `${err.httpStatus} ${err.code}. ${err.message}`,
          });
          return;
        }
        throw err;
      }
    },
    [session],
  );

  const handleReset = useCallback(() => {
    setSession(initLifecycleSession());
    setVerdict(INITIAL_VERDICT);
  }, []);

  return (
    <PokeShell
      label="@caisson/agent-kernel · lifecycle act FSM"
      title="Skip an act. Watch the typed error, not a silent skip."
    >
      <ol className={styles.stepper}>
        {ACTS.map((act) => {
          const isCurrent = act === session.current;
          const legal = canTransition(session.current, act);
          return (
            <li key={act} className={styles.step}>
              <button
                type="button"
                className={styles.actButton}
                data-current={isCurrent}
                data-legal={!isCurrent && legal}
                disabled={isCurrent}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => handleClickAct(act)}
              >
                {act}
              </button>
              {isTerminal(act) ? (
                <span className={styles.terminalTag}>terminal</span>
              ) : null}
            </li>
          );
        })}
      </ol>

      <p className={styles.hint}>
        From <strong>{session.current}</strong>, the legal next acts are
        highlighted. Click any other act to see the illegal transition throw.
      </p>

      <ol className={styles.trace}>
        {session.trace.length === 0 ? (
          <li className={styles.traceEmpty}>No transitions taken yet.</li>
        ) : (
          session.trace.map((step) => (
            <li key={step.seq} className={styles.traceRow}>
              <span className={styles.traceSeq}>{step.seq}</span>
              <span className={styles.traceEdge}>
                {step.from} <span aria-hidden="true">&rarr;</span> {step.to}
              </span>
            </li>
          ))
        )}
      </ol>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.buttonGhost}
          onClick={handleReset}
        >
          Reset to spec
        </button>
      </div>

      <Verdict state={verdict.state}>{verdict.message}</Verdict>
    </PokeShell>
  );
}

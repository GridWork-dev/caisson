"use client";

// The agent-kernel module's flagship "poke" (ADR-0378 lock 2, kimi spec: "agent-kernel: click
// transitions across ACTS, canTransition verdicts, a failed VERIFY reopens PLAN, an illegal skip
// throws"). A deterministic in-browser replay of the REAL lifecycle act FSM: `ACTS`,
// `canTransition`, `isTerminal`, and `transition` all come from `@caisson-sh/agent-kernel/browser`,
// the package's browser-safe entry (ADR-0396), and an illegal click surfaces the package's own
// `ValidationError`. The hand-ported mirror this poke used to drive is deleted.
//
// Poke-local below the imports: only the click SESSION (which act we are on, which steps have been
// taken) — presentation state the package has no opinion about. No transition rule is restated
// here. Nothing fetches, persists, or measures the visitor.
import { useCallback, useState } from "react";
import { ValidationError } from "@caisson-sh/kernel";
import {
  ACTS,
  canTransition,
  isTerminal,
  transition,
  type Act,
  type LifecycleStep,
} from "@caisson-sh/agent-kernel/browser";

import { PokeShell, Verdict, type VerdictState } from "./poke-rig";
import styles from "./agent-kernel-poke.module.css";

/** One click session: the current act plus every legal transition taken so far. */
export interface LifecycleSession {
  readonly current: Act;
  readonly trace: readonly LifecycleStep[];
}

/** The sample starting point — always `spec`, the real FSM's only entry act. */
export function initLifecycleSession(): LifecycleSession {
  return { current: ACTS[0], trace: [] };
}

/**
 * Attempt one click through the REAL `transition()`: it validates the edge and throws before this
 * function builds anything, so an illegal target never leaves a half-applied step behind.
 */
export function attemptTransition(
  session: LifecycleSession,
  to: Act,
): { session: LifecycleSession; step: LifecycleStep } {
  const from = session.current;
  transition(from, to);
  const step: LifecycleStep = { seq: session.trace.length, from, to };
  return { session: { current: to, trace: [...session.trace, step] }, step };
}

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
        if (err instanceof ValidationError) {
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
      label="@caisson-sh/agent-kernel · lifecycle act FSM"
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

"use client";

// "Replay a run" (ADR-0378 lock 2, flagship F-agent-trajectory). A fixed sample trajectory (all
// eleven @caisson/agent-trajectory event kinds, agent-trajectory-logic.ts's SAMPLE_RUN) folded by
// the real `project()` fold (mirrored byte-for-byte, golden-pinned in agent-trajectory-logic.test.ts
// against packages/agent-trajectory/src). Replay it in recorded order and reversed arrival and watch
// the projection match; then tamper the one model.usage event and watch it either fail the schema's
// own credits/billingStatus invariant, or stay valid while the projected total quietly diverges from
// what the run recorded. Sensitive bodies never render, only their DigestRef (digest + byte length).
import { useMemo, useState } from "react";

import { PokeShell, Verdict } from "./poke-rig";
import styles from "./agent-trajectory-poke.module.css";
import {
  breakInvariant,
  eventDigest,
  eventSummary,
  evaluate,
  inflateCredits,
  initialState,
  RECORDED_METERED_CREDITS,
  reset,
  shortDigest,
  verdictLine,
  type PokeState,
} from "./agent-trajectory-logic";

const KIND_TONE: Record<string, string> = {
  "run.started": "root",
  "run.finished": "root",
  "step.started": "ok",
  "step.finished": "ok",
  "model.call": "neutral",
  "model.usage": "neutral",
  "tool.proposed": "neutral",
  "tool.approved": "ok",
  "tool.denied": "fail",
  "tool.result": "ok",
  checkpoint: "root",
};

export default function AgentTrajectoryPoke() {
  const [state, setState] = useState<PokeState>(() => initialState());

  const result = useMemo(() => evaluate(state), [state]);
  const line = useMemo(() => verdictLine(result, state), [result, state]);

  const meteredCredits = result.projection.usageTotals.metered.credits;
  const creditsMismatch = meteredCredits !== RECORDED_METERED_CREDITS;

  return (
    <PokeShell
      label="@caisson/agent-trajectory"
      title="Replay a run twice. Then tamper one event and watch the verdict flip."
    >
      <p className={styles.sample}>
        Sample run (fixed, not live): a governed agent triaging a repo issue.
      </p>

      <ol className={styles.timeline}>
        {state.events.map((event) => {
          const digest = eventDigest(event);
          return (
            <li
              key={event.eventId}
              className={styles.row}
              data-tone={KIND_TONE[event.kind] ?? "neutral"}
            >
              <span className={styles.seq}>#{event.seq}</span>
              <span className={styles.kind}>{event.kind}</span>
              <span className={styles.summary}>{eventSummary(event)}</span>
              {digest ? (
                <code className={styles.digest}>
                  digest {shortDigest(digest.digest)} · {digest.byteLength}B
                </code>
              ) : (
                <span className={styles.digestEmpty} aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.action}
          onClick={() => setState((s) => inflateCredits(s))}
        >
          Inflate credits
        </button>
        <button
          type="button"
          className={styles.action}
          onClick={() => setState((s) => breakInvariant(s))}
        >
          Break the invariant
        </button>
        <button
          type="button"
          className={styles.action}
          onClick={() => setState(reset())}
          disabled={state.tamper === "none"}
        >
          Reset
        </button>
      </div>

      <div className={styles.projection}>
        <div className={styles.projectionHead}>
          <span className={styles.projectionTitle}>Projection</span>
          <span
            className={styles.projectionState}
            data-tone={result.orderIndependent ? "ok" : "fail"}
          >
            {result.orderIndependent ? "Order-independent" : "Order-dependent"}
          </span>
        </div>
        <dl className={styles.projectionGrid}>
          <dt>status</dt>
          <dd>{result.projection.status}</dd>
          <dt>usageTotals.metered.credits</dt>
          <dd data-tone={creditsMismatch ? "fail" : "ok"}>
            {meteredCredits}
            {creditsMismatch ? ` (recorded ${RECORDED_METERED_CREDITS})` : ""}
          </dd>
          <dt>checkpoints</dt>
          <dd>{result.projection.checkpoints.length}</dd>
        </dl>
        <p className={styles.note}>
          model.call and tool.* fold to no projection state here, recorded and
          replayable, just not folded (replay.ts).
        </p>
      </div>

      <Verdict state={line.state}>{line.text}</Verdict>
    </PokeShell>
  );
}

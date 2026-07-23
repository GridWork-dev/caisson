"use client";

// The alerting module's "poke" (ADR-0378 lock 2, kimi CANDIDATES section B). A deterministic
// in-browser replay of the alert pipeline (packages/alerting/src/pipeline.ts + orchestrator.ts):
// dedup -> rate-cap with digest fallback -> timezone-aware quiet hours (critical override) ->
// multi-channel delivery, every outcome landing one audit row. Runs on the package's REAL pure
// pipeline math, mirrored in ./alerting-logic.ts and golden-pinned against the real package in
// ./alerting-logic.test.ts (see that file's header for why the mirror exists instead of a direct
// import). Nothing here fetches, persists, or measures the visitor.
import { useCallback, useState } from "react";

import { PokeShell, Verdict, type VerdictState } from "./poke-rig";
import {
  QUIET_POLICY,
  SAMPLE_CHANNELS,
  SAMPLE_EVENT_TYPE,
  SAMPLE_NOW_BUSINESS,
  SAMPLE_NOW_QUIET,
  SAMPLE_RATE_POLICY,
  SAMPLE_SEVERITY,
  SAMPLE_TZ,
  floodStep,
  initAlertSession,
  resetSession,
  sendDuplicateStep,
  sendOnceStep,
  toggleQuietStep,
  type AlertSession,
  type ProcessResult,
} from "./alerting-logic";
import styles from "./alerting-poke.module.css";

interface VerdictLine {
  state: VerdictState;
  message: string;
}

function formatClock(epochMs: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SAMPLE_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(epochMs));
}

function describeOutcome(result: ProcessResult): string {
  switch (result.outcome) {
    case "delivered":
      return `Delivered to ${result.deliveries.map((d) => d.channel).join(", ")}.`;
    case "suppressed":
      return "Suppressed. An incident for this alert is already open.";
    case "digested":
      return "Rate cap reached. Folded into the digest instead of sending now.";
    case "held":
      return "Held. Inside the recipient's quiet hours.";
  }
}

function verdictFor(result: ProcessResult, prefix = ""): VerdictLine {
  const state: VerdictState =
    result.outcome === "delivered"
      ? "ok"
      : result.outcome === "suppressed"
        ? "neutral"
        : "fail";
  return { state, message: `${prefix}${describeOutcome(result)}` };
}

export default function AlertingPoke() {
  const [session, setSession] = useState<AlertSession>(() =>
    initAlertSession(),
  );
  const [verdict, setVerdict] = useState<VerdictLine>({
    state: "neutral",
    message: "Send an alert through the pipeline.",
  });

  const handleSendOnce = useCallback(() => {
    const { session: next, result } = sendOnceStep(session);
    setSession(next);
    setVerdict(verdictFor(result));
  }, [session]);

  const handleSendDuplicate = useCallback(() => {
    const outcome = sendDuplicateStep(session);
    if (outcome === null) {
      setVerdict({
        state: "neutral",
        message: "Send once first, then duplicate it.",
      });
      return;
    }
    setSession(outcome.session);
    setVerdict(verdictFor(outcome.result));
  }, [session]);

  const handleFlood = useCallback(() => {
    const { session: next, results, trippedAtSend } = floodStep(session);
    setSession(next);
    setVerdict({
      state: trippedAtSend === null ? "ok" : "fail",
      message:
        trippedAtSend === null
          ? `Flooded ${results.length} alerts. Rate cap held.`
          : `Flooded ${results.length} alerts. Rate cap tripped at send ${trippedAtSend}, now digesting.`,
    });
  }, [session]);

  const handleToggleQuiet = useCallback(() => {
    const { session: next, result } = toggleQuietStep(session);
    setSession(next);
    const modeLabel =
      next.quietMode === "quiet" ? "quiet hours" : "business hours";
    setVerdict(verdictFor(result, `Sample clock set to ${modeLabel}. `));
  }, [session]);

  const handleReset = useCallback(() => {
    setSession(resetSession());
    setVerdict({
      state: "neutral",
      message: "Send an alert through the pipeline.",
    });
  }, []);

  const clockNow =
    session.quietMode === "quiet" ? SAMPLE_NOW_QUIET : SAMPLE_NOW_BUSINESS;

  return (
    <PokeShell
      label={`@caisson/alerting · ${SAMPLE_TZ}`}
      title="Push one alert through dedup, rate-cap, quiet hours, and delivery."
    >
      <div className={styles.meta}>
        <span className={styles.badge}>{SAMPLE_EVENT_TYPE}</span>
        <span className={styles.badge}>severity {SAMPLE_SEVERITY}</span>
        <span className={styles.badge}>
          rate cap {SAMPLE_RATE_POLICY.maxPerWindow}/window
        </span>
        <span className={styles.badge}>
          quiet {QUIET_POLICY.startHour}:00-{QUIET_POLICY.endHour}:00
        </span>
        <span className={styles.badge}>
          channels {SAMPLE_CHANNELS.join(", ")}
        </span>
      </div>

      <div className={styles.clock}>
        <span className={styles.clockLamp} data-mode={session.quietMode}>
          <span className={styles.clockDot} aria-hidden="true" />
          Sample clock <strong>{formatClock(clockNow)}</strong>,{" "}
          {session.quietMode === "quiet" ? "quiet hours" : "business hours"}
        </span>
        <span>
          Recent sends <strong>{session.recentCount}</strong> /{" "}
          {SAMPLE_RATE_POLICY.maxPerWindow}
        </span>
        <span>
          Open incidents <strong>{session.openIncidents.length}</strong>
        </span>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.button}
          onClick={handleSendOnce}
        >
          Send once
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={handleSendDuplicate}
          disabled={session.lastEvent === null}
        >
          Send duplicate
        </button>
        <button type="button" className={styles.button} onClick={handleFlood}>
          Flood
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={handleToggleQuiet}
        >
          Toggle quiet hours
        </button>
        <button
          type="button"
          className={styles.buttonGhost}
          onClick={handleReset}
        >
          Reset
        </button>
      </div>

      <ul className={styles.audit}>
        {session.audit.length === 0 ? (
          <li className={styles.auditEmpty}>No alerts sent yet.</li>
        ) : (
          session.audit.slice(0, 6).map((row) => (
            <li
              key={row.id}
              className={styles.auditRow}
              data-outcome={row.outcome}
            >
              <span className={styles.auditOutcome}>
                {row.outcome.toUpperCase()}
              </span>
              <span className={styles.auditChannels}>
                {row.channels.length > 0
                  ? row.channels.map((c) => c.channel).join(", ")
                  : "no delivery"}
              </span>
              <span className={styles.auditClock}>{formatClock(row.at)}</span>
            </li>
          ))
        )}
      </ul>

      <Verdict state={verdict.state}>{verdict.message}</Verdict>
    </PokeShell>
  );
}

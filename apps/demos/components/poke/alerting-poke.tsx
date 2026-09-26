"use client";

// The alerting module's "poke" (ADR-0378 lock 2). A deterministic in-browser replay of the REAL
// `@caisson-sh/alerting` pipeline: dedup -> rate-cap with digest fallback -> timezone-aware quiet
// hours (critical override) -> multi-channel delivery, every outcome landing exactly one audit row.
// The hand-ported mirror this used to drive is deleted (ADR-0396): `processAlert`, the event-type
// registry, the capture channel driver, and the in-memory audit sink all come from
// `@caisson-sh/alerting/browser`, the package's browser-safe entry (`.` minus the five network
// drivers, which need a webhook signing secret and a DNS-resolving SSRF check — neither belongs in
// a browser). Poke-local: the sample event type, the fixed recipient timezone, the two fixed sample
// clocks, and the session bookkeeping the four controls need.
//
// No Date.now(), no Math.random(): both sample clocks are fixed epoch-ms constants and every send
// gets a counter-derived id/dedupeKey, so replaying the same click sequence always produces the
// same outcomes. Nothing here fetches, persists, or measures the visitor.
import { useCallback, useState } from "react";
import {
  DEFAULT_EVENT_TYPE_REGISTRY,
  createCaptureChannel,
  createInMemoryAuditSink,
  processAlert,
} from "@caisson-sh/alerting/browser";
import type {
  AlertAuditRow,
  AlertEvent,
  AlertSeverity,
  OpenIncident,
  ProcessAlertResult,
  QuietHoursPolicy,
  RateCapPolicy,
} from "@caisson-sh/alerting/browser";

import { PokeShell, Verdict, type VerdictState } from "./poke-rig";
import styles from "./alerting-poke.module.css";

/** The event type this poke pushes — warning severity, so it is subject to quiet hours (a critical
 *  event always overrides). Its policy comes from the package's own DEFAULT_EVENT_TYPE_REGISTRY. */
export const SAMPLE_EVENT_TYPE = "auth.failed_login_spike";

/** Fixed IANA recipient timezone, visibly labeled in the UI — never inferred from the visitor. */
export const SAMPLE_TZ = "America/New_York";

/** A 10pm-7am recipient-local quiet window (wraps midnight). */
export const QUIET_POLICY: QuietHoursPolicy = { startHour: 22, endHour: 7 };

/** Fixed sample clock: 2:00 PM America/New_York (EDT, UTC-4) — business hours, outside the quiet
 *  window. */
export const SAMPLE_NOW_BUSINESS = Date.parse("2026-07-15T18:00:00.000Z");

/** Fixed sample clock: 2:00 AM America/New_York (EDT, UTC-4) — inside the quiet window. */
export const SAMPLE_NOW_QUIET = Date.parse("2026-07-15T06:00:00.000Z");

/** How many alerts one "Flood" click fires — bounded so the demo can never loop forever. */
export const FLOOD_BURST_COUNT = 8;

const SAMPLE_EVENT_TYPE_CONFIG = DEFAULT_EVENT_TYPE_REGISTRY[SAMPLE_EVENT_TYPE];
if (SAMPLE_EVENT_TYPE_CONFIG === undefined) {
  throw new Error(`no event-type entry for ${SAMPLE_EVENT_TYPE}`);
}

/** The rate-cap policy the real registry declares for SAMPLE_EVENT_TYPE. */
export const SAMPLE_RATE_POLICY: RateCapPolicy =
  SAMPLE_EVENT_TYPE_CONFIG.ratePolicy;

/** The channels SAMPLE_EVENT_TYPE delivers to, per the real registry. */
export const SAMPLE_CHANNELS: readonly string[] =
  SAMPLE_EVENT_TYPE_CONFIG.channels;

/** SAMPLE_EVENT_TYPE's default severity — warning, so it is subject to quiet hours. */
export const SAMPLE_SEVERITY: AlertSeverity =
  SAMPLE_EVENT_TYPE_CONFIG.defaultSeverity;

export type QuietMode = "business" | "quiet";

function sampleClockFor(mode: QuietMode): number {
  return mode === "quiet" ? SAMPLE_NOW_QUIET : SAMPLE_NOW_BUSINESS;
}

function buildEvent(dedupeKey: string, seq: number, now: number): AlertEvent {
  return {
    id: `evt-${seq}`,
    type: SAMPLE_EVENT_TYPE,
    severity: SAMPLE_SEVERITY,
    tenantId: "sample-tenant",
    recipient: "ops@sample.test",
    dedupeKey,
    title: "Failed login spike",
    body: "5 failed logins from a new device in 2 minutes.",
    createdAt: now,
  };
}

export interface AlertSession {
  openIncidents: readonly OpenIncident[];
  recentCount: number;
  quietMode: QuietMode;
  /** Newest first — the package's own audit rows, straight off the sink. */
  audit: readonly AlertAuditRow[];
  sendCounter: number;
  lastEvent: AlertEvent | null;
}

export function initAlertSession(): AlertSession {
  return {
    openIncidents: [],
    recentCount: 0,
    quietMode: "business",
    audit: [],
    sendCounter: 0,
    lastEvent: null,
  };
}

export interface SendOutcome {
  session: AlertSession;
  event: AlertEvent;
  result: ProcessAlertResult;
}

/**
 * Runs one event through the REAL `processAlert` against the session's current state, then updates
 * the session: a non-suppressed send opens (or keeps open) its dedupeKey's incident and bumps the
 * rate-cap window. The sink is fresh per send, so the row it holds afterwards IS the package's
 * always-write-exactly-one-audit-row rule — the poke reads it rather than restating it.
 */
async function sendStep(
  session: AlertSession,
  dedupeKey: string,
): Promise<SendOutcome> {
  const now = sampleClockFor(session.quietMode);
  const seq = session.sendCounter + 1;
  const event = buildEvent(dedupeKey, seq, now);
  const auditSink = createInMemoryAuditSink();

  const result = await processAlert(event, {
    openIncidents: session.openIncidents,
    recentCount: session.recentCount,
    ratePolicy: SAMPLE_RATE_POLICY,
    recipientTz: SAMPLE_TZ,
    quietPolicy: QUIET_POLICY,
    now: new Date(now),
    channels: SAMPLE_CHANNELS.map((name) => createCaptureChannel(name)),
    auditSink,
  });

  let openIncidents = session.openIncidents;
  let recentCount = session.recentCount;
  if (result.outcome !== "suppressed") {
    recentCount += 1;
    if (!openIncidents.some((i) => i.dedupeKey === event.dedupeKey)) {
      openIncidents = [...openIncidents, { dedupeKey: event.dedupeKey }];
    }
  }

  const next: AlertSession = {
    openIncidents,
    recentCount,
    quietMode: session.quietMode,
    audit: [...auditSink.rows, ...session.audit],
    sendCounter: seq,
    lastEvent: event,
  };

  return { session: next, event, result };
}

/** Control 1: push a fresh alert (a new dedupeKey each click) — delivers, given headroom and the
 *  clock outside the quiet window. */
export function sendOnceStep(session: AlertSession): Promise<SendOutcome> {
  return sendStep(session, `login-spike-${session.sendCounter + 1}`);
}

/** Control 2: replay the LAST sent dedupeKey — dedup() finds it already open and suppresses it.
 *  `null` when nothing has been sent yet (nothing to duplicate). */
export async function sendDuplicateStep(
  session: AlertSession,
): Promise<SendOutcome | null> {
  if (session.lastEvent === null) return null;
  return sendStep(session, session.lastEvent.dedupeKey);
}

export interface FloodOutcome {
  session: AlertSession;
  results: readonly ProcessAlertResult[];
  trippedAtSend: number | null;
}

/** Control 3: fires FLOOD_BURST_COUNT distinct alerts back to back (no dedup collisions) until the
 *  rate cap trips to digest. */
export async function floodStep(session: AlertSession): Promise<FloodOutcome> {
  let current = session;
  const results: ProcessAlertResult[] = [];
  let trippedAtSend: number | null = null;

  for (let i = 1; i <= FLOOD_BURST_COUNT; i++) {
    const { session: next, result } = await sendStep(
      current,
      `flood-${current.sendCounter + 1}`,
    );
    current = next;
    results.push(result);
    if (result.outcome === "digested" && trippedAtSend === null) {
      trippedAtSend = i;
    }
  }

  return { session: current, results, trippedAtSend };
}

/** Control 4: flips the sample clock between business hours and quiet hours, then immediately sends
 *  a fresh alert under the new clock — the one control guaranteed to show both the deliver and the
 *  hold path. */
export function toggleQuietStep(session: AlertSession): Promise<SendOutcome> {
  return sendOnceStep({
    ...session,
    quietMode: session.quietMode === "business" ? "quiet" : "business",
  });
}

export function resetSession(): AlertSession {
  return initAlertSession();
}

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

function describeOutcome(result: ProcessAlertResult): string {
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

function verdictFor(result: ProcessAlertResult, prefix = ""): VerdictLine {
  const state: VerdictState =
    result.outcome === "delivered"
      ? "ok"
      : result.outcome === "suppressed"
        ? "neutral"
        : "fail";
  return { state, message: `${prefix}${describeOutcome(result)}` };
}

const IDLE_VERDICT: VerdictLine = {
  state: "neutral",
  message: "Send an alert through the pipeline.",
};

export default function AlertingPoke() {
  const [session, setSession] = useState<AlertSession>(() =>
    initAlertSession(),
  );
  const [verdict, setVerdict] = useState<VerdictLine>(IDLE_VERDICT);
  // Every control drives the real (async) processAlert, so a step's setSession
  // lands in a .then() continuation outside the click event. `busy` blocks a
  // second click from starting a step against a stale closure of `session`
  // while one is still in flight (rapid double-click / key auto-repeat).
  const [busy, setBusy] = useState(false);

  const handleSendOnce = useCallback(() => {
    if (busy) return;
    setBusy(true);
    void sendOnceStep(session).then(({ session: next, result }) => {
      setSession(next);
      setVerdict(verdictFor(result));
      setBusy(false);
    });
  }, [session, busy]);

  const handleSendDuplicate = useCallback(() => {
    if (busy) return;
    setBusy(true);
    void sendDuplicateStep(session).then((outcome) => {
      if (outcome === null) {
        setVerdict({
          state: "neutral",
          message: "Send once first, then duplicate it.",
        });
        setBusy(false);
        return;
      }
      setSession(outcome.session);
      setVerdict(verdictFor(outcome.result));
      setBusy(false);
    });
  }, [session, busy]);

  const handleFlood = useCallback(() => {
    if (busy) return;
    setBusy(true);
    void floodStep(session).then(
      ({ session: next, results, trippedAtSend }) => {
        setSession(next);
        setVerdict({
          state: trippedAtSend === null ? "ok" : "fail",
          message:
            trippedAtSend === null
              ? `Flooded ${results.length} alerts. Rate cap held.`
              : `Flooded ${results.length} alerts. Rate cap tripped at send ${trippedAtSend}, now digesting.`,
        });
        setBusy(false);
      },
    );
  }, [session, busy]);

  const handleToggleQuiet = useCallback(() => {
    if (busy) return;
    setBusy(true);
    void toggleQuietStep(session).then(({ session: next, result }) => {
      setSession(next);
      const modeLabel =
        next.quietMode === "quiet" ? "quiet hours" : "business hours";
      setVerdict(verdictFor(result, `Sample clock set to ${modeLabel}. `));
      setBusy(false);
    });
  }, [session, busy]);

  const handleReset = useCallback(() => {
    setSession(resetSession());
    setVerdict(IDLE_VERDICT);
    setBusy(false);
  }, []);

  const clockNow =
    session.quietMode === "quiet" ? SAMPLE_NOW_QUIET : SAMPLE_NOW_BUSINESS;

  return (
    <PokeShell
      label={`@caisson-sh/alerting · ${SAMPLE_TZ}`}
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
          disabled={busy}
        >
          Send once
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={handleSendDuplicate}
          disabled={busy || session.lastEvent === null}
        >
          Send duplicate
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={handleFlood}
          disabled={busy}
        >
          Flood
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={handleToggleQuiet}
          disabled={busy}
        >
          Toggle quiet hours
        </button>
        <button
          type="button"
          className={styles.buttonGhost}
          onClick={handleReset}
          disabled={busy}
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
              key={row.eventId}
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

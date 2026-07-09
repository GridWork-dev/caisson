// The orchestrator (ADR-0135): runs the five stages in order — dedup -> rateCap -> quietHours ->
// deliverAll -> auditLog — short-circuiting at the first non-"deliver" outcome and always writing
// exactly one audit row. `now` and every dependency are injected (no module-level state), so the
// whole pipeline is deterministically testable.
import { dedup, rateCap, quietHours } from "./pipeline.ts";
import type { OpenIncident, QuietHoursPolicy } from "./pipeline.ts";
import { deliverAll } from "./channels.ts";
import type { AlertChannel, DeliveryResult } from "./channels.ts";
import type { AlertAuditSink, AlertOutcome } from "./audit.ts";
import type { AlertEvent, RateCapPolicy } from "./types.ts";

export interface ProcessAlertDeps {
  openIncidents: readonly OpenIncident[];
  /** Recent send count for this recipient within the rate-cap window (integer, ADR-0007). */
  recentCount: number;
  ratePolicy: RateCapPolicy;
  recipientTz: string;
  quietPolicy: QuietHoursPolicy;
  now: Date;
  channels: readonly AlertChannel[];
  auditSink: AlertAuditSink;
}

export interface ProcessAlertResult {
  outcome: AlertOutcome;
  deliveries: readonly DeliveryResult[];
}

async function finish(
  event: AlertEvent,
  deps: ProcessAlertDeps,
  outcome: AlertOutcome,
  deliveries: readonly DeliveryResult[],
): Promise<ProcessAlertResult> {
  await deps.auditSink.record({
    eventId: event.id,
    type: event.type,
    severity: event.severity,
    tenantId: event.tenantId,
    recipient: event.recipient,
    outcome,
    channels: deliveries,
    at: deps.now.getTime(),
  });
  return { outcome, deliveries };
}

export async function processAlert(
  event: AlertEvent,
  deps: ProcessAlertDeps,
): Promise<ProcessAlertResult> {
  if (dedup(event, deps.openIncidents)) {
    return finish(event, deps, "suppressed", []);
  }

  if (rateCap(event, deps.recentCount, deps.ratePolicy) === "digest") {
    return finish(event, deps, "digested", []);
  }

  if (
    quietHours(event, deps.recipientTz, deps.quietPolicy, deps.now) === "hold"
  ) {
    return finish(event, deps, "held", []);
  }

  const deliveries = await deliverAll(event, deps.channels);
  return finish(event, deps, "delivered", deliveries);
}

/**
 * `processAlert` with "no history" deps — for a caller with no persisted incident/rate-cap store
 * of its own (a background-job failure, a scheduler-tick failure): always dedup-passes, never
 * rate-caps, never quiet-hours-holds. Saves every such caller from hand-rolling the same empty
 * `ProcessAlertDeps` object. Not a substitute for the real pipeline where dedup/rate-cap state
 * exists (e.g. `error-triage.ts`) — those callers keep using `processAlert` directly.
 */
export async function deliverImmediate(
  event: AlertEvent,
  channels: readonly AlertChannel[],
  auditSink: AlertAuditSink,
  now: Date = new Date(),
): Promise<ProcessAlertResult> {
  return processAlert(event, {
    openIncidents: [],
    recentCount: 0,
    ratePolicy: { maxPerWindow: Number.MAX_SAFE_INTEGER },
    recipientTz: "UTC",
    quietPolicy: { startHour: 0, endHour: 0 },
    now,
    channels,
    auditSink,
  });
}

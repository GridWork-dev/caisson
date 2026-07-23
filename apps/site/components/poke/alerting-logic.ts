// Pure, deterministic mirror of @caisson/alerting's pipeline (packages/alerting/src/pipeline.ts +
// orchestrator.ts + types.ts + audit.ts) plus a local, synchronous session replay for the poke's
// four controls. The package's ONLY export subpath is "." (package.json `exports`), and that one
// barrel (src/index.ts) re-exports channels.ts in the same module graph as the pure pipeline
// functions - channels.ts imports `node:crypto` directly (for the webhook HMAC signature) and
// `@caisson/kernel`'s ssrf.ts imports `node:dns/promises` at module scope (needed by
// assertSafePublicUrlResolved, which channels.ts also imports). Neither resolves in a browser
// bundle, and no subpath export exists to reach pipeline.ts/orchestrator.ts/audit.ts alone. So
// every function and constant below is mirrored by hand from the real source and pinned in
// alerting-logic.test.ts, which imports "@caisson/alerting" directly (tests run under bun, where
// node:crypto and node:dns/promises resolve fine) and asserts identical output on identical input,
// including a full processAlert() run against the real package's own dedup/rateCap/quietHours and
// its createCaptureChannel/createInMemoryAuditSink drivers (both pure/in-memory, no network - safe
// to run in a test).
//
// No Date.now(), no Math.random(): the two sample clocks below are fixed epoch-ms constants, and
// every send in a session gets a counter-derived id/dedupeKey, so replaying the same click sequence
// always produces the same outcomes.

export const ALERT_SEVERITIES = ["info", "warning", "critical"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export interface AlertEvent {
  id: string;
  type: string;
  severity: AlertSeverity;
  tenantId: string;
  recipient: string;
  dedupeKey: string;
  title: string;
  body: string;
  /** Epoch ms. */
  createdAt: number;
}

export interface RateCapPolicy {
  maxPerWindow: number;
}

export interface EventTypeConfig {
  defaultSeverity: AlertSeverity;
  channels: readonly string[];
  ratePolicy: RateCapPolicy;
}

export type EventTypeRegistry = Readonly<Record<string, EventTypeConfig>>;

/** Mirrors DEFAULT_EVENT_TYPE_REGISTRY, packages/alerting/src/types.ts - byte-identical, pinned in
 *  alerting-logic.test.ts. */
export const DEFAULT_EVENT_TYPE_REGISTRY: EventTypeRegistry = {
  "auth.failed_login_spike": {
    defaultSeverity: "warning",
    channels: ["email", "slack"],
    ratePolicy: { maxPerWindow: 5 },
  },
  "billing.payment_failed": {
    defaultSeverity: "critical",
    channels: ["email", "webhook"],
    ratePolicy: { maxPerWindow: 3 },
  },
  "compliance.export_requested": {
    defaultSeverity: "info",
    channels: ["email"],
    ratePolicy: { maxPerWindow: 10 },
  },
  "system.error_rate_high": {
    defaultSeverity: "critical",
    channels: ["slack", "telegram"],
    ratePolicy: { maxPerWindow: 3 },
  },
};

// ---- Stage 1-3: pipeline.ts (mirrored verbatim) ----

export interface OpenIncident {
  dedupeKey: string;
}

/** Mirrors dedup(), packages/alerting/src/pipeline.ts. */
export function dedup(
  event: AlertEvent,
  openIncidents: readonly OpenIncident[],
): boolean {
  return openIncidents.some(
    (incident) => incident.dedupeKey === event.dedupeKey,
  );
}

/** Mirrors rateCap(), packages/alerting/src/pipeline.ts. */
export function rateCap(
  _event: AlertEvent,
  recentCount: number,
  policy: RateCapPolicy,
): "deliver" | "digest" {
  return recentCount >= policy.maxPerWindow ? "digest" : "deliver";
}

export interface QuietHoursPolicy {
  /** Recipient-local hour (0-23) the quiet window starts. */
  startHour: number;
  /** Recipient-local hour (0-23) the quiet window ends (exclusive). May be < `startHour` (wraps midnight). */
  endHour: number;
}

/** Mirrors the private recipientLocalHour(), packages/alerting/src/pipeline.ts - resolves the
 *  recipient-local hour via `Intl`, browser-native, no timezone dependency. */
function recipientLocalHour(tz: string, now: Date): number {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    throw new Error(`quietHours: invalid IANA timeZone "${tz}"`);
  }
  const hour = parts.find((p) => p.type === "hour")?.value;
  if (hour === undefined) {
    throw new Error(
      `quietHours: could not resolve an hour for timeZone "${tz}"`,
    );
  }
  return Number(hour);
}

/** Mirrors the private inQuietWindow(), packages/alerting/src/pipeline.ts. */
function inQuietWindow(hour: number, policy: QuietHoursPolicy): boolean {
  const { startHour, endHour } = policy;
  if (startHour === endHour) return false;
  return startHour < endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour;
}

/** Mirrors quietHours(), packages/alerting/src/pipeline.ts - a `critical` event always overrides to
 *  `deliver`, no matter the hour. */
export function quietHours(
  event: AlertEvent,
  recipientTz: string,
  policy: QuietHoursPolicy,
  now: Date,
): "deliver" | "hold" {
  if (event.severity === "critical") return "deliver";
  return inQuietWindow(recipientLocalHour(recipientTz, now), policy)
    ? "hold"
    : "deliver";
}

// ---- Stage 4-5: channels.ts + audit.ts, simplified to a sample driver ----
//
// The real drivers POST to buyer-supplied endpoints (email/webhook/Slack/Telegram/Discord); this
// poke never fetches anything (ADR-0378 lock 2), so delivery is mirrored as the same always-succeeds
// shape createCaptureChannel() returns for each channel name in the event type's registered list.

export interface DeliveryResult {
  channel: string;
  ok: boolean;
}

/** Mirrors deliverAll() over a sample capture-only channel set, packages/alerting/src/channels.ts. */
function deliverAll(channels: readonly string[]): DeliveryResult[] {
  return channels.map((channel) => ({ channel, ok: true }));
}

export type AlertOutcome = "delivered" | "suppressed" | "held" | "digested";

export interface AuditRow {
  id: number;
  eventId: string;
  type: string;
  severity: AlertSeverity;
  outcome: AlertOutcome;
  channels: readonly DeliveryResult[];
  /** Epoch ms - the injected sample clock, never a live one. */
  at: number;
}

// ---- Orchestration: orchestrator.ts (mirrored, sync - no network/DB in this replay) ----

export interface ProcessDeps {
  openIncidents: readonly OpenIncident[];
  recentCount: number;
  ratePolicy: RateCapPolicy;
  recipientTz: string;
  quietPolicy: QuietHoursPolicy;
  now: Date;
  channels: readonly string[];
}

export interface ProcessResult {
  outcome: AlertOutcome;
  deliveries: readonly DeliveryResult[];
}

/** Mirrors processAlert(), packages/alerting/src/orchestrator.ts: dedup -> rateCap -> quietHours ->
 *  deliverAll, short-circuiting at the first non-"deliver" outcome. */
export function processAlert(
  event: AlertEvent,
  deps: ProcessDeps,
): ProcessResult {
  if (dedup(event, deps.openIncidents)) {
    return { outcome: "suppressed", deliveries: [] };
  }
  if (rateCap(event, deps.recentCount, deps.ratePolicy) === "digest") {
    return { outcome: "digested", deliveries: [] };
  }
  if (
    quietHours(event, deps.recipientTz, deps.quietPolicy, deps.now) === "hold"
  ) {
    return { outcome: "held", deliveries: [] };
  }
  return { outcome: "delivered", deliveries: deliverAll(deps.channels) };
}

// ---- Sample fixture: one event type, one recipient timezone, two fixed sample clocks ----

/** The event type this poke pushes - warning severity, so it is subject to quiet hours (a critical
 *  event always overrides). Mirrors DEFAULT_EVENT_TYPE_REGISTRY["auth.failed_login_spike"] above. */
export const SAMPLE_EVENT_TYPE = "auth.failed_login_spike";

/** Fixed IANA recipient timezone, visibly labeled in the UI - never inferred from the visitor. */
export const SAMPLE_TZ = "America/New_York";

/** A 10pm-7am recipient-local quiet window (wraps midnight). */
export const QUIET_POLICY: QuietHoursPolicy = { startHour: 22, endHour: 7 };

/** Fixed sample clock: 2:00 PM America/New_York (EDT, UTC-4) - business hours, outside the quiet
 *  window. */
export const SAMPLE_NOW_BUSINESS = Date.parse("2026-07-15T18:00:00.000Z");

/** Fixed sample clock: 2:00 AM America/New_York (EDT, UTC-4) - inside the quiet window. */
export const SAMPLE_NOW_QUIET = Date.parse("2026-07-15T06:00:00.000Z");

/** How many alerts one "Flood" click fires - bounded so the demo can never loop forever. */
export const FLOOD_BURST_COUNT = 8;

const SAMPLE_EVENT_TYPE_CONFIG = DEFAULT_EVENT_TYPE_REGISTRY[SAMPLE_EVENT_TYPE];
if (SAMPLE_EVENT_TYPE_CONFIG === undefined) {
  throw new Error(`no event-type entry for ${SAMPLE_EVENT_TYPE}`);
}

/** The rate-cap policy for SAMPLE_EVENT_TYPE - resolved once so callers never need to guard an
 *  indexed lookup themselves. */
export const SAMPLE_RATE_POLICY: RateCapPolicy =
  SAMPLE_EVENT_TYPE_CONFIG.ratePolicy;

/** The channels SAMPLE_EVENT_TYPE delivers to. */
export const SAMPLE_CHANNELS: readonly string[] =
  SAMPLE_EVENT_TYPE_CONFIG.channels;

/** SAMPLE_EVENT_TYPE's default severity - warning, so it is subject to quiet hours. */
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
  openIncidents: OpenIncident[];
  recentCount: number;
  quietMode: QuietMode;
  audit: AuditRow[];
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
  result: ProcessResult;
}

/** Runs one event through processAlert() against the session's current state, then updates the
 *  session: a non-suppressed send opens (or keeps open) its dedupeKey's incident and bumps the
 *  recentCount window; every send lands one audit row (mirrors the orchestrator's always-write-one-
 *  audit-row rule). */
function sendStep(session: AlertSession, dedupeKey: string): SendOutcome {
  const now = sampleClockFor(session.quietMode);
  const seq = session.sendCounter + 1;
  const event = buildEvent(dedupeKey, seq, now);

  const result = processAlert(event, {
    openIncidents: session.openIncidents,
    recentCount: session.recentCount,
    ratePolicy: SAMPLE_RATE_POLICY,
    recipientTz: SAMPLE_TZ,
    quietPolicy: QUIET_POLICY,
    now: new Date(now),
    channels: SAMPLE_CHANNELS,
  });

  let openIncidents = session.openIncidents;
  let recentCount = session.recentCount;
  if (result.outcome !== "suppressed") {
    recentCount += 1;
    if (!openIncidents.some((i) => i.dedupeKey === event.dedupeKey)) {
      openIncidents = [...openIncidents, { dedupeKey: event.dedupeKey }];
    }
  }

  const auditRow: AuditRow = {
    id: session.audit.length + 1,
    eventId: event.id,
    type: event.type,
    severity: event.severity,
    outcome: result.outcome,
    channels: result.deliveries,
    at: now,
  };

  const next: AlertSession = {
    openIncidents,
    recentCount,
    quietMode: session.quietMode,
    audit: [auditRow, ...session.audit],
    sendCounter: seq,
    lastEvent: event,
  };

  return { session: next, event, result };
}

/** Control 1: push a fresh alert (a new dedupeKey each click) - delivers, given headroom and the
 *  clock outside the quiet window. */
export function sendOnceStep(session: AlertSession): SendOutcome {
  return sendStep(session, `login-spike-${session.sendCounter + 1}`);
}

/** Control 2: replay the LAST sent dedupeKey - dedup() finds it already open and suppresses it.
 *  `null` when nothing has been sent yet (nothing to duplicate). */
export function sendDuplicateStep(session: AlertSession): SendOutcome | null {
  if (session.lastEvent === null) return null;
  return sendStep(session, session.lastEvent.dedupeKey);
}

export interface FloodOutcome {
  session: AlertSession;
  results: ProcessResult[];
  trippedAtSend: number | null;
}

/** Control 3: fires FLOOD_BURST_COUNT distinct alerts back to back (no dedup collisions) until the
 *  rate cap trips to digest. */
export function floodStep(session: AlertSession): FloodOutcome {
  let current = session;
  const results: ProcessResult[] = [];
  let trippedAtSend: number | null = null;

  for (let i = 1; i <= FLOOD_BURST_COUNT; i++) {
    const { session: next, result } = sendStep(
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
 *  a fresh alert under the new clock - the one control guaranteed to show both the deliver and the
 *  hold path. */
export function toggleQuietStep(session: AlertSession): SendOutcome {
  const flipped: AlertSession = {
    ...session,
    quietMode: session.quietMode === "business" ? "quiet" : "business",
  };
  return sendOnceStep(flipped);
}

export function resetSession(): AlertSession {
  return initAlertSession();
}

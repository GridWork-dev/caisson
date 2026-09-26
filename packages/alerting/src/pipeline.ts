// Stages 1-3 of the alerting pipeline (ADR-0135): dedup -> rate-cap+digest -> quiet-hours. Pure
// functions — no fetch, no Date.now() (time is always injected), so every branch is a one-line
// unit test.
import { ConfigError } from "@caisson-sh/kernel";
import type { AlertEvent, RateCapPolicy } from "./types.ts";

export interface OpenIncident {
  dedupeKey: string;
}

/** Stage 1: suppress a repeat while an already-open incident shares its `dedupeKey`. */
export function dedup(
  event: AlertEvent,
  openIncidents: readonly OpenIncident[],
): boolean {
  return openIncidents.some(
    (incident) => incident.dedupeKey === event.dedupeKey,
  );
}

/** Stage 2: once the recipient's recent count reaches the policy cap, fall back to a digest. */
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

/** Resolve the recipient-local hour (0-23) via `Intl` — no timezone dependency. */
function recipientLocalHour(tz: string, now: Date): number {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    throw new ConfigError(`quietHours: invalid IANA timeZone "${tz}"`);
  }
  const hour = parts.find((p) => p.type === "hour")?.value;
  if (hour === undefined) {
    throw new ConfigError(
      `quietHours: could not resolve an hour for timeZone "${tz}"`,
    );
  }
  return Number(hour);
}

function inQuietWindow(hour: number, policy: QuietHoursPolicy): boolean {
  const { startHour, endHour } = policy;
  if (startHour === endHour) return false;
  return startHour < endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour;
}

/**
 * Stage 3: hold delivery inside the recipient-local quiet window; a `critical` event always
 * overrides to `deliver`, no matter the hour.
 */
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

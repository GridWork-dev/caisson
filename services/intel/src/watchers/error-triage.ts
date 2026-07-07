// Error triage watcher (the alerting dogfood): PostHog error-tracking groups → `@caisson/alerting`
// (dedup / rate-cap / quiet-hours) → the configured sinks (tg-bridge + Linear) + a durable finding.
// The alert dedup identity encodes an order-of-magnitude bucket of the occurrence count, so a
// steady error stays deduped while a genuinely spiking one (crossing 10 → 100 → …) re-alerts once.
// The brief is DETERMINISTIC; an LLM root-cause paragraph is the same off-by-default seam
// (enrichment runs later, in the scheduler, gated on INTEL_LLM_ENABLED).
import { createInMemoryAuditSink, processAlert } from "@caisson/alerting";
import type {
  AlertChannel,
  AlertEvent,
  OpenIncident,
  QuietHoursPolicy,
  RateCapPolicy,
} from "@caisson/alerting";
import { dedupKey } from "../finding.ts";
import { buildAlertChannels } from "../sinks.ts";
import { createPostHogClient } from "../posthog.ts";
import type { ErrorGroup } from "../posthog.ts";
import type { Finding, Severity } from "../finding.ts";
import type { Watcher, WatcherCtx } from "./types.ts";

// An error open in the last day suppresses re-alerts; at most N new alerts fire per hour.
const DEDUP_WINDOW_MS = 24 * 3_600_000;
const RATE_WINDOW_MS = 3_600_000;

/** Order-of-magnitude bucket of an occurrence count — the spike signal (0:1-9, 1:10-99, …). */
export function magnitude(count: number): number {
  return count <= 1 ? 0 : Math.floor(Math.log10(count));
}

export function severityForCount(count: number): Severity {
  if (count >= 100) return "critical";
  if (count >= 10) return "warning";
  return "info";
}

/** Stable finding for a group at its current magnitude — a spike into a new magnitude is a new row. */
export function errorGroupToFinding(group: ErrorGroup): Finding {
  const key = dedupKey(
    "error",
    group.fingerprint,
    `mag${String(magnitude(group.occurrences))}`,
  );
  return {
    source: "error",
    kind: "error_group",
    severity: severityForCount(group.occurrences),
    title: `Error: ${group.name}`.slice(0, 300),
    body: `Error group "${group.name}" has ${String(group.occurrences)} occurrences.${group.url !== undefined ? ` ${group.url}` : ""}`,
    dedupKey: key,
    payload: {
      fingerprint: group.fingerprint,
      occurrences: group.occurrences,
      ...(group.url !== undefined ? { url: group.url } : {}),
    },
  };
}

export function errorGroupToAlertEvent(
  group: ErrorGroup,
  finding: Finding,
  nowMs: number,
): AlertEvent {
  return {
    id: crypto.randomUUID(),
    type: "system.error_group",
    severity: finding.severity,
    tenantId: "operator",
    recipient: "operator",
    dedupeKey: finding.dedupKey,
    title: finding.title.slice(0, 200),
    body: finding.body.slice(0, 5000),
    createdAt: nowMs,
  };
}

export interface TriageDeps {
  store: WatcherCtx["store"];
  channels: readonly AlertChannel[];
  ratePolicy: RateCapPolicy;
  recipientTz: string;
  quietPolicy: QuietHoursPolicy;
  now: () => number;
}

/** Run each error group through the alerting pipeline and return the findings (the scheduler
 *  persists them). Self-caps within the batch: a delivered event increments the rate count and
 *  joins the open-incident set so a burst can't spam or double-alert the same group. */
export async function triageErrors(
  groups: readonly ErrorGroup[],
  deps: TriageDeps,
): Promise<Finding[]> {
  const nowMs = deps.now();
  const openIncidents: OpenIncident[] = (
    await deps.store.openIncidentKeys("error", nowMs - DEDUP_WINDOW_MS)
  ).map((dedupeKey) => ({ dedupeKey }));
  let delivered = await deps.store.countNewFindings(
    "error",
    nowMs - RATE_WINDOW_MS,
  );
  const auditSink = createInMemoryAuditSink();
  const findings: Finding[] = [];

  for (const group of groups) {
    const finding = errorGroupToFinding(group);
    findings.push(finding);
    const event = errorGroupToAlertEvent(group, finding, nowMs);
    const result = await processAlert(event, {
      openIncidents,
      recentCount: delivered,
      ratePolicy: deps.ratePolicy,
      recipientTz: deps.recipientTz,
      quietPolicy: deps.quietPolicy,
      now: new Date(nowMs),
      channels: deps.channels,
      auditSink,
    });
    if (result.outcome === "delivered") {
      delivered += 1;
      openIncidents.push({ dedupeKey: event.dedupeKey });
    }
  }
  return findings;
}

export const errorTriageWatcher: Watcher = {
  name: "error",
  cadenceMs: (config) => config.cadenceErrorMs,
  async run(ctx: WatcherCtx): Promise<Finding[]> {
    const client = createPostHogClient(ctx.config, ctx.fetchImpl);
    if (client === null) return [];
    let groups: ErrorGroup[];
    try {
      groups = await client.errorGroups();
    } catch (err) {
      ctx.logger.warn("posthog error groups fetch failed", {
        err: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
    if (groups.length === 0) return [];
    return triageErrors(groups, {
      store: ctx.store,
      channels: buildAlertChannels(ctx.config, ctx.fetchImpl),
      ratePolicy: { maxPerWindow: ctx.config.alertRateMaxPerWindow },
      recipientTz: ctx.config.alertTz,
      quietPolicy: {
        startHour: ctx.config.alertQuietStart,
        endHour: ctx.config.alertQuietEnd,
      },
      now: ctx.now,
    });
  },
};

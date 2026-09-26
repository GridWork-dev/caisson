// src/evidence/drift/alert-sink.ts — the drift-regression alert event + delivery port (ADR-0371,
// SPEC item 3).
//
// `DriftAlertEvent` mirrors @caisson-sh/alerting's `AlertEvent` shape field-for-field (id/type/severity/
// tenantId/recipient/dedupeKey/title/body/createdAt): compliance-core stays dependency-free of
// @caisson-sh/alerting — the same precedent `external-anchor.ts` already set for @caisson-sh/audit-worm
// ("only the two grade literals are load-bearing here"). Because the shapes match exactly, a caller
// wires the REAL `AlertChannel[]` from @caisson-sh/alerting straight into `deliverToAll` — TypeScript's
// structural typing makes it assignable with no adapter, satisfying "route through the existing
// AlertChannel port, no new transport" without adding a runtime dependency to this package.
import { z } from "zod";
import { strictObject } from "@caisson-sh/kernel";

export const DRIFT_ALERT_EVENT_TYPE = "compliance.drift_regression";

export const driftAlertEventSchema = strictObject({
  id: z.string().trim().min(1).max(200),
  type: z.literal(DRIFT_ALERT_EVENT_TYPE),
  severity: z.enum(["info", "warning", "critical"]),
  tenantId: z.string().trim().min(1).max(200),
  recipient: z.string().trim().min(1).max(320),
  dedupeKey: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  /** Epoch ms — mirrors `AlertEvent.createdAt`. */
  createdAt: z.number().int().nonnegative(),
});
export type DriftAlertEvent = z.infer<typeof driftAlertEventSchema>;

/** The delivery result shape — structurally identical to @caisson-sh/alerting's `DeliveryResult`. */
export interface DriftDeliveryResult {
  readonly channel: string;
  readonly ok: boolean;
  readonly error?: string;
}

/** The minimal delivery port — structurally identical to @caisson-sh/alerting's `AlertChannel`, so a
 *  real channel (email/webhook/Slack/Telegram/Discord/capture) is directly assignable here. */
export interface DriftAlertChannel {
  readonly name: string;
  deliver(event: DriftAlertEvent): Promise<DriftDeliveryResult>;
}

const DEDUPE_KEY_MAX = 200;

/** Build the alert event for one regression transition. Pure given `id`/`now` (both injected at the
 *  edge — the same clock/id-at-the-edge discipline `generate.ts` and the collector constructors use). */
export function buildDriftAlertEvent(input: {
  readonly id: string;
  readonly tenantId: string;
  readonly recipient: string;
  readonly controlId: string;
  readonly collectorId: string;
  readonly reason: string;
  readonly now: Date;
}): DriftAlertEvent {
  const dedupeKey =
    `drift:${input.tenantId}:${input.controlId}:${input.collectorId}`.slice(
      0,
      DEDUPE_KEY_MAX,
    );
  return {
    id: input.id,
    type: DRIFT_ALERT_EVENT_TYPE,
    severity: "warning",
    tenantId: input.tenantId,
    recipient: input.recipient,
    dedupeKey,
    title: `Compliance drift: ${input.controlId} regressed`,
    body: `${input.controlId} (${input.collectorId}) newly flagged: ${input.reason}`,
    createdAt: input.now.getTime(),
  };
}

/** Deliver `event` to every channel, isolating one failing/throwing channel from the rest — mirrors
 *  @caisson-sh/alerting's own `deliverAll` per-channel isolation contract. */
export async function deliverToAll(
  event: DriftAlertEvent,
  channels: readonly DriftAlertChannel[],
): Promise<readonly DriftDeliveryResult[]> {
  return Promise.all(
    channels.map(async (channel): Promise<DriftDeliveryResult> => {
      try {
        return await channel.deliver(event);
      } catch (err) {
        return {
          channel: channel.name,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );
}

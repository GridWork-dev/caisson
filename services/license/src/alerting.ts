// Job-failure alerting for this service's pg-boss consumers. Builds the
// `@caisson/jobs` `JobAlertingDeps` port (see pgboss.ts — that package stays dependency-free of
// this commercial `@caisson/alerting`) using the real alerting pipeline: `deliverImmediate` (no
// persisted incident/rate-cap state of its own — a job failure is rare + always `critical`, so
// dedup/rate-cap/quiet-hours would only add a store this service doesn't otherwise need) fanned out
// to the operator's Discord ops channel. Absent `DISCORD_OPS_WEBHOOK_URL` = zero configured
// channels = `deliverAll` degrades to a harmless no-op, mirroring `discord-notify.ts`'s
// config-gated, never-throws posture.
import {
  createDiscordChannel,
  createInMemoryAuditSink,
  deliverImmediate,
} from "@caisson/alerting";
import type { AlertChannel, AlertEvent } from "@caisson/alerting";
import type { JobAlertingDeps } from "@caisson/jobs";

/** Resolve the ops Discord alert channels from env; empty (no channel) unless
 *  `DISCORD_OPS_WEBHOOK_URL` is set. Same load-from-env, fail-safe-absent shape as
 *  `loadDiscordNotifyConfig` (discord-notify.ts) — a DIFFERENT Discord integration (this posts an
 *  ops-alert embed via a webhook; that one pushes buyer roles via the support-bot API). */
export function loadOpsAlertChannels(
  env: Record<string, string | undefined> = process.env,
): AlertChannel[] {
  const url = env.DISCORD_OPS_WEBHOOK_URL?.trim() ?? "";
  return url === "" ? [] : [createDiscordChannel({ webhookUrl: url })];
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function jobTaskFailedEvent(
  taskName: string,
  message: string,
  nowMs: number,
): AlertEvent {
  return {
    id: crypto.randomUUID(),
    type: "jobs.task_failed",
    severity: "critical",
    tenantId: "operator",
    recipient: "operator",
    dedupeKey: `jobs.task_failed:${taskName}`,
    title: `Job task failed: ${taskName}`,
    body: message.slice(0, 5000),
    createdAt: nowMs,
  };
}

function jobInfraErrorEvent(message: string, nowMs: number): AlertEvent {
  return {
    id: crypto.randomUUID(),
    type: "jobs.infra_error",
    severity: "critical",
    tenantId: "operator",
    recipient: "operator",
    dedupeKey: "jobs.infra_error",
    title: "pg-boss infra error",
    body: message.slice(0, 5000),
    createdAt: nowMs,
  };
}

/** Build the `@caisson/jobs` `JobAlertingDeps` port over the given channels. Never throws back
 *  into pg-boss's `work()` wrapper / `error` event handler — every delivery attempt is
 *  self-contained (`deliverImmediate` already isolates per-channel failures; this adds the outer
 *  catch pg-boss's own callers require). */
export function createJobAlertingDeps(
  channels: readonly AlertChannel[],
): JobAlertingDeps {
  return {
    async reportTaskFailure(taskName: string, error: unknown): Promise<void> {
      try {
        await deliverImmediate(
          jobTaskFailedEvent(taskName, toMessage(error), Date.now()),
          channels,
          createInMemoryAuditSink(),
        );
      } catch {
        // Alerting must never mask the original job failure.
      }
    },
    async reportInfraError(error: unknown): Promise<void> {
      try {
        await deliverImmediate(
          jobInfraErrorEvent(toMessage(error), Date.now()),
          channels,
          createInMemoryAuditSink(),
        );
      } catch {
        // Same posture — never throw back into pg-boss's error event dispatch.
      }
    },
  };
}

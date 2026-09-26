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
import type { RateBucket } from "./rate-limit.ts";

export type RateLimiterFailureMode = "open" | "closed";

/** Deliberately excludes request, client, and raw-error data so an infrastructure alert can never
 * leak headers, tokens, request bodies, IP addresses, or provider connection strings. */
export interface RateLimiterInfraAlert {
  bucket: RateBucket;
  failureMode: RateLimiterFailureMode;
}

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

function withSuppressedNote(message: string, suppressedCount: number): string {
  return suppressedCount > 0
    ? `${message} (${String(suppressedCount)} more failure(s) suppressed in the last 5 min)`
    : message;
}

function jobTaskFailedEvent(
  taskName: string,
  message: string,
  nowMs: number,
  suppressedCount: number,
): AlertEvent {
  return {
    id: crypto.randomUUID(),
    type: "jobs.task_failed",
    severity: "critical",
    tenantId: "operator",
    recipient: "operator",
    dedupeKey: `jobs.task_failed:${taskName}`,
    title: `Job task failed: ${taskName}`,
    body: withSuppressedNote(message, suppressedCount).slice(0, 5000),
    createdAt: nowMs,
  };
}

function jobInfraErrorEvent(
  message: string,
  nowMs: number,
  suppressedCount: number,
): AlertEvent {
  return {
    id: crypto.randomUUID(),
    type: "jobs.infra_error",
    severity: "critical",
    tenantId: "operator",
    recipient: "operator",
    dedupeKey: "jobs.infra_error",
    title: "pg-boss infra error",
    body: withSuppressedNote(message, suppressedCount).slice(0, 5000),
    createdAt: nowMs,
  };
}

function rateLimiterInfraErrorEvent(
  alert: RateLimiterInfraAlert,
  nowMs: number,
  suppressedCount: number,
): AlertEvent {
  return {
    id: crypto.randomUUID(),
    type: "license.rate_limiter_infra_error",
    severity: "critical",
    tenantId: "operator",
    recipient: "operator",
    dedupeKey: `license.rate_limiter_infra_error:${alert.bucket}:${alert.failureMode}`,
    title: "License rate limiter unavailable",
    body: withSuppressedNote(
      `The ${alert.bucket} limiter threw; request handling applied fail-${alert.failureMode} policy.`,
      suppressedCount,
    ),
    createdAt: nowMs,
  };
}

const ALERT_COOLDOWN_MS = 5 * 60_000;

/**
 * A per-key cooldown: the first call for a key alerts immediately, further calls for the SAME key
 * within the window are suppressed (counted, not delivered). `credit-expiry-scheduler.ts` enqueues
 * one job per wallet account per tick — a shared-handler bug or DB blip fires the SAME task name
 * for every account, which without this would be one Discord POST per account.
 *
 * ponytail: in-memory per-process — a multi-instance deploy alerts once per INSTANCE per window,
 * not once globally. Acceptable for an ops page (worst case a couple of duplicate alerts, never a
 * flood); upgrade to a shared store (Postgres/Redis) only if that proves noisy in practice.
 */
function createCooldown(windowMs = ALERT_COOLDOWN_MS) {
  const lastSentAt = new Map<string, number>();
  const suppressedSince = new Map<string, number>();
  return (key: string): number | null => {
    const now = Date.now();
    const last = lastSentAt.get(key);
    if (last !== undefined && now - last < windowMs) {
      suppressedSince.set(key, (suppressedSince.get(key) ?? 0) + 1);
      return null;
    }
    const suppressed = suppressedSince.get(key) ?? 0;
    suppressedSince.delete(key);
    lastSentAt.set(key, now);
    return suppressed;
  };
}

/** Build the `@caisson/jobs` `JobAlertingDeps` port over the given channels. Never throws back
 *  into pg-boss's `work()` wrapper / `error` event handler — every delivery attempt is
 *  self-contained (`deliverImmediate` already isolates per-channel failures; this adds the outer
 *  catch pg-boss's own callers require). A shared cooldown caps ALERT volume only — the caller
 *  (`pgboss.ts`) always re-throws regardless of what this port does, so pg-boss's own retry/
 *  dead-letter handling is never affected by suppression here. */
export function createJobAlertingDeps(
  channels: readonly AlertChannel[],
): JobAlertingDeps {
  const cooldown = createCooldown();
  return {
    async reportTaskFailure(taskName: string, error: unknown): Promise<void> {
      const suppressed = cooldown(`jobs.task_failed:${taskName}`);
      if (suppressed === null) return;
      try {
        await deliverImmediate(
          jobTaskFailedEvent(
            taskName,
            toMessage(error),
            Date.now(),
            suppressed,
          ),
          channels,
          createInMemoryAuditSink(),
        );
      } catch {
        // Alerting must never mask the original job failure.
      }
    },
    async reportInfraError(error: unknown): Promise<void> {
      const suppressed = cooldown("jobs.infra_error");
      if (suppressed === null) return;
      try {
        await deliverImmediate(
          jobInfraErrorEvent(toMessage(error), Date.now(), suppressed),
          channels,
          createInMemoryAuditSink(),
        );
      } catch {
        // Same posture — never throw back into pg-boss's error event dispatch.
      }
    },
  };
}

/** Build the detached, never-throw operational alert used by the HTTP router when limiter
 * infrastructure throws. A per-bucket/policy cooldown prevents an outage from paging once per
 * request while preserving separate signals for the availability-biased webhook and protected
 * fail-closed routes. */
export function createRateLimiterAlert(
  channels: readonly AlertChannel[],
): (alert: RateLimiterInfraAlert) => Promise<void> {
  const cooldown = createCooldown();
  return async (alert: RateLimiterInfraAlert): Promise<void> => {
    const key = `license.rate_limiter_infra_error:${alert.bucket}:${alert.failureMode}`;
    const suppressed = cooldown(key);
    if (suppressed === null) return;
    try {
      await deliverImmediate(
        rateLimiterInfraErrorEvent(alert, Date.now(), suppressed),
        channels,
        createInMemoryAuditSink(),
      );
    } catch {
      // Alert delivery must never change the route's locked failure policy.
    }
  };
}

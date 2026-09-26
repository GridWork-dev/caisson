// Shared types for the alerting pipeline (ADR-0135). `AlertEvent` is the one Zod-`.strict()`
// boundary every stage consumes; `EventTypeRegistry` is a data-only per-event-type policy table
// (this ships the shape + a small seed — extend with your own event types per real usage).
import { z } from "zod";
import { strictObject } from "@caisson-sh/kernel";

export const AlertSeveritySchema = z.enum(["info", "warning", "critical"]);
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;

export const AlertEventSchema = strictObject({
  id: z.string().trim().min(1).max(200),
  type: z.string().trim().min(1).max(100),
  severity: AlertSeveritySchema,
  tenantId: z.string().trim().min(1).max(200),
  recipient: z.string().trim().min(1).max(320),
  dedupeKey: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  /** Epoch ms. */
  createdAt: z.number().int().nonnegative(),
});
export type AlertEvent = z.infer<typeof AlertEventSchema>;

export interface RateCapPolicy {
  /** Integer count (ADR-0007); at or above this many recent sends the event digests instead. */
  maxPerWindow: number;
}

export interface EventTypeConfig {
  defaultSeverity: AlertSeverity;
  channels: readonly string[];
  ratePolicy: RateCapPolicy;
}

/** `eventType -> policy`. Declaration only — callers resolve `event.type` against this. */
export type EventTypeRegistry = Readonly<Record<string, EventTypeConfig>>;

/** A small seed, not an exhaustive catalog (YAGNI — extend per real usage). */
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

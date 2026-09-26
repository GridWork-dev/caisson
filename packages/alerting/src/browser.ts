// The browser-safe entry (`@caisson-sh/alerting/browser`, ADR-0396): the event contract, all three
// decision stages, the delivery port with its isolation wrapper and capture driver, the audit port
// with its in-memory driver, and the orchestrator itself. In other words the whole pipeline except
// the five NETWORK drivers in `channels.ts`, which are irreducibly node-only (`node:crypto` for the
// webhook HMAC, `@caisson-sh/kernel/node` for the DNS-resolving SSRF re-check) and have no business in
// a client bundle anyway — a browser cannot hold a webhook signing secret.
//
// ADDITIVE: `.` is untouched and keeps the full surface; every name here is also on `.`
// (browser-safety.test.ts pins the subset direction, one-way). The duplicated export lines are the
// price of leaving `.` provably unchanged — the subset test is the drift guard.
export {
  AlertSeveritySchema,
  AlertEventSchema,
  DEFAULT_EVENT_TYPE_REGISTRY,
} from "./types.ts";
export type {
  AlertSeverity,
  AlertEvent,
  RateCapPolicy,
  EventTypeConfig,
  EventTypeRegistry,
} from "./types.ts";

export { dedup, rateCap, quietHours } from "./pipeline.ts";
export type { OpenIncident, QuietHoursPolicy } from "./pipeline.ts";

export { deliverAll, createCaptureChannel } from "./delivery.ts";
export type {
  DeliveryResult,
  AlertChannel,
  CaptureChannel,
} from "./delivery.ts";

export { createInMemoryAuditSink } from "./audit.ts";
export type {
  AlertOutcome,
  AlertAuditRow,
  AlertAuditSink,
  CaptureAuditSink,
} from "./audit.ts";

export { processAlert, deliverImmediate } from "./orchestrator.ts";
export type { ProcessAlertDeps, ProcessAlertResult } from "./orchestrator.ts";

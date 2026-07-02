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

export {
  deliverAll,
  createCaptureChannel,
  createEmailChannel,
  createWebhookChannel,
  createSlackChannel,
  createTelegramChannel,
  WebhookConfigSchema,
  SlackConfigSchema,
  TelegramConfigSchema,
} from "./channels.ts";
export type {
  DeliveryResult,
  AlertChannel,
  CaptureChannel,
  WebhookConfig,
  SlackConfig,
  TelegramConfig,
} from "./channels.ts";

export { createInMemoryAuditSink } from "./audit.ts";
export type {
  AlertOutcome,
  AlertAuditRow,
  AlertAuditSink,
  CaptureAuditSink,
} from "./audit.ts";

export { processAlert } from "./orchestrator.ts";
export type { ProcessAlertDeps, ProcessAlertResult } from "./orchestrator.ts";

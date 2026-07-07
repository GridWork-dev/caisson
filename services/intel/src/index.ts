// @caisson/service-intel — the standing intelligence daemon (ADR-0286). Watches compliance
// frameworks, competitor pages, GitHub traction, product analytics, and production errors;
// detects change cheaply and deterministically first, then appends durable findings to the
// admin database's intel schema. Production errors additionally route through the alerting
// pipeline to the operator's Telegram bridge and an auto-filed issue.
export { loadConfig } from "./config.ts";
export type { Config } from "./config.ts";
export {
  dedupKey,
  FindingSchema,
  FINDING_SOURCES,
  parseFinding,
  SEVERITIES,
} from "./finding.ts";
export type { Finding, FindingSource, Severity } from "./finding.ts";
export { InMemoryStore, PostgresStore } from "./store.ts";
export type { Store, UpsertResult } from "./store.ts";
export { runWatcher, startScheduler } from "./scheduler.ts";
export type { RunSummary, SchedulerHandle } from "./scheduler.ts";
export { createHealthzHandler, startHealthzServer } from "./healthz.ts";
export { startService } from "./server.ts";
export { WATCHERS, findWatcher, watcherNames } from "./watchers/index.ts";
export type { Watcher, WatcherCtx } from "./watchers/types.ts";

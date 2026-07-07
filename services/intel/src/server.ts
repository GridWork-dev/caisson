// The production boot entrypoint. Loads config from env (fail-closed on a missing
// INTEL_DATABASE_URL), applies the additive intel-schema migration, binds the /healthz server,
// and starts the internal scheduler (the ADR-0286 §5 default runner — one interval per watcher).
// `import.meta.main` gates this the same way services/docs and services/license do: a test can
// import the pieces (config/store/scheduler) without ever booting a real process.
import { fetchWithTimeout } from "@caisson/kernel";
import { initObservability } from "@caisson/observability";
import { loadConfig } from "./config.ts";
import { startHealthzServer } from "./healthz.ts";
import { logger } from "./logger.ts";
import { startScheduler } from "./scheduler.ts";
import { PostgresStore } from "./store.ts";

export async function startService(): Promise<{ stop: () => Promise<void> }> {
  // ADR-0117 pattern: wired first, before any module that OTel instruments (pg, fetch/undici).
  initObservability({ serviceName: "service-intel" });

  const config = loadConfig();
  const store = new PostgresStore(config.databaseUrl);
  await store.migrate();
  logger.info("intel schema migration applied");

  const healthz = startHealthzServer(config.healthzPort, config.healthzHost);
  logger.info("healthz listening", { port: config.healthzPort });

  const scheduler = config.schedulerEnabled
    ? startScheduler(config, store, fetchWithTimeout)
    : { stop: (): void => undefined };
  if (!config.schedulerEnabled) {
    logger.warn(
      "scheduler disabled (INTEL_SCHEDULER_ENABLED=false) — watchers run only via CLI",
    );
  }

  return {
    async stop(): Promise<void> {
      scheduler.stop();
      healthz.stop();
      await store.close();
    },
  };
}

if (import.meta.main) {
  await startService();
}

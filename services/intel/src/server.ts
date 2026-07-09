// The production boot entrypoint. Loads config from env (fail-closed on a missing
// INTEL_DATABASE_URL), binds the /healthz server, and starts the internal scheduler (the
// ADR-0286 §5 default runner — one interval per watcher). `import.meta.main` gates this the
// same way services/docs and services/license do: a test can import the pieces
// (config/store/scheduler) without ever booting a real process.
import { fetchWithTimeout } from "@caisson/kernel";
import { initObservability } from "@caisson/observability";
import { loadConfig } from "./config.ts";
import { startHealthzServer } from "./healthz.ts";
import { logger } from "./logger.ts";
import { startScheduler } from "./scheduler.ts";
import { buildAlertChannels } from "./sinks.ts";
import { PostgresStore } from "./store.ts";

export async function startService(): Promise<{ stop: () => Promise<void> }> {
  // ADR-0117 pattern: wired first, before any module that OTel instruments (pg, fetch/undici).
  initObservability({ serviceName: "service-intel" });

  const config = loadConfig();
  const store = new PostgresStore(config.databaseUrl);

  if (config.migrateOnBoot) {
    // Opt-in only (default off): the runtime DSN is meant to be the DML-only intel_role
    // (migrations/provision-role.sql) which does NOT hold the DDL privileges migrate() needs.
    // The production posture is the operator applying the migration once, out-of-band, as an
    // owning role — this flag exists for a first local/dev boot's convenience only.
    await store.migrate();
    logger.info("intel schema migration applied (INTEL_MIGRATE_ON_BOOT=true)");
  } else {
    // The opt-in containment self-check: proves the runtime role really can't read commerce
    // data. Belt-and-suspenders on top of provision-role.sql's REVOKE, not a hard boot
    // dependency — a failure to even RUN the check (network hiccup) logs and never blocks boot.
    try {
      const isolated = await store.checkRoleIsolation();
      if (isolated) {
        logger.info(
          "role isolation check passed — the intel DSN role cannot read public.accounts",
        );
      } else {
        logger.error(
          "ROLE ISOLATION CHECK FAILED — the intel DSN role CAN read public.accounts. This " +
            "violates the least-privilege containment ADR-0286 requires. Rotate INTEL_DATABASE_URL " +
            "to a role provisioned by migrations/provision-role.sql immediately.",
        );
      }
    } catch (err) {
      logger.warn("role isolation check could not run", {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Housekeeping, best-effort: a failure here must never block boot — a fatter-than-ideal
  // intel.runs table is a cost problem, not an availability one.
  await store.pruneRuns().catch((err: unknown) => {
    logger.warn("run-ledger prune failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  });

  const healthz = startHealthzServer(config.healthzPort, config.healthzHost);
  logger.info("healthz listening", { port: config.healthzPort });

  const scheduler = config.schedulerEnabled
    ? startScheduler(
        config,
        store,
        fetchWithTimeout,
        buildAlertChannels(config, fetchWithTimeout),
      )
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
  // Every runWatcher/scheduler path already guards its own promises (scheduler.ts), but this is
  // the last line of defense: a transient failure anywhere in the process must log, not crash
  // the daemon (Postgres/network blips are expected on a long-lived box process).
  process.on("unhandledRejection", (reason: unknown) => {
    logger.error("unhandled rejection — logged, not crashing", {
      err: reason instanceof Error ? reason.message : String(reason),
    });
  });

  const service = await startService();

  // `docker compose stop` sends SIGTERM; Ctrl-C in a foreground run sends SIGINT. Either must
  // clear the scheduler's intervals and close the pg pool cleanly rather than the process being
  // killed mid-request.
  const shutdown = (signal: string): void => {
    logger.info("shutting down", { signal });
    void service.stop().finally(() => process.exit(0));
  };
  process.on("SIGTERM", () => {
    shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    shutdown("SIGINT");
  });
}

// Next instrumentation hook (ADR-0138): wires vendor-neutral OpenTelemetry for the admin
// control-plane's Node runtime, exported via OTLP to Grafana Cloud (ADR-0177 cutover — the fleet's
// sole OTLP sink). Env-gated — a no-op when `OTEL_EXPORTER_OTLP_ENDPOINT` is unset (dev / CI / no
// OTLP endpoint configured), the same pattern every provider port in this repo follows. Next calls
// `register()` once, before any other
// module in the `nodejs` runtime is evaluated — instrumenting HTTP/fetch/Postgres spans requires
// that ordering, so this MUST stay the first thing the runtime does.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { initObservability } = await import("@caisson/observability");
  initObservability({ serviceName: "admin" });

  // CAISSON-48: ensure admin's OWN better-auth tables exist before the first request (ADR-0283).
  // This USED to be a railway.toml preDeployCommand, but that is a silent no-op on the Next
  // standalone runtime image — it copies only `.next/standalone`, which strips `src/`, so
  // `bun apps/admin/src/lib/admin-deploy-migrate.ts` can't be found. `register()` ships in
  // standalone and Next awaits it before serving, so a fresh ADMIN_AUTH_DATABASE_URL is migrated
  // before the first OAuth callback (which would otherwise 500 on relation-does-not-exist and lock
  // the operator out). Env-gated (no-op in dev/CI where the URL is unset) and idempotent.
  //
  // On failure we do NOT rethrow (a hard throw here risks crash-looping the whole control-plane,
  // taking /ops down with it) — instead we mark the boot unhealthy so `/healthz` fails closed. That
  // makes Railway keep the last-good deploy rather than promote one whose auth 500s, and surfaces a
  // visible failed-deploy instead of a silent lockout; a later deploy/restart re-runs the idempotent
  // migration once the DB is reachable. See admin-boot-state.ts.
  const adminAuthDbUrl = process.env.ADMIN_AUTH_DATABASE_URL?.trim();
  if (adminAuthDbUrl !== undefined && adminAuthDbUrl.length > 0) {
    const { markAuthMigrationFailed, markAuthMigrationOk } =
      await import("./lib/admin-boot-state.ts");
    try {
      const { ensureAdminAuthTables } =
        await import("./lib/admin-deploy-migrate.ts");
      await ensureAdminAuthTables(adminAuthDbUrl);
      markAuthMigrationOk();
    } catch (err) {
      markAuthMigrationFailed();
      process.stderr.write(
        `[admin] better-auth migration failed at boot — /healthz will report unhealthy so this ` +
          `deploy is not promoted; re-run a deploy once the DB is reachable: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }
}

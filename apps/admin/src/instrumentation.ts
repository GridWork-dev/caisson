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
  // the operator out). Env-gated (no-op in dev/CI where the URL is unset), idempotent, and
  // catch-logged so a transient DB blip at boot doesn't wedge startup — the migrator re-attempts on
  // the next restart (Railway ON_FAILURE), and the tables, once created, persist.
  const adminAuthDbUrl = process.env.ADMIN_AUTH_DATABASE_URL?.trim();
  if (adminAuthDbUrl !== undefined && adminAuthDbUrl.length > 0) {
    try {
      const { ensureAdminAuthTables } =
        await import("./lib/admin-deploy-migrate.ts");
      await ensureAdminAuthTables(adminAuthDbUrl);
    } catch (err) {
      process.stderr.write(
        `[admin] better-auth migration failed at boot (auth routes 500 until it succeeds; ` +
          `retried on next restart): ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }
}

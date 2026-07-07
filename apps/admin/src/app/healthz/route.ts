// Railway readiness probe (ADR-0114/0138). Mirrors apps/site's `/healthz` — no DB round-trip (the
// admin's own routes prove DB connectivity per-request; the probe itself must stay cheap so it never
// flaps on a slow query). The ONE gate it honors is the boot-migration flag (CAISSON-48): if the
// better-auth migration failed at boot, this reports 503 so Railway fails the deploy closed rather
// than promote a control-plane whose every OAuth callback 500s. Reading the flag is a cheap boolean.
import { isAuthMigrationHealthy } from "../../lib/admin-boot-state.ts";

export const dynamic = "force-dynamic";

export function GET(): Response {
  const ok = isAuthMigrationHealthy();
  return new Response(JSON.stringify({ ok }), {
    status: ok ? 200 : 503,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

// Boot-migration readiness (CAISSON-48). `instrumentation.register()` runs the better-auth
// migration before the server accepts traffic; if it FAILS, the process would otherwise stay up and
// `/healthz` would report `{ ok: true }` — so Railway promotes a deploy whose every OAuth callback
// 500s on relation-does-not-exist, locking the operator out of their own control-plane with no
// visible signal. This flag lets `/healthz` fail closed instead: a failed boot migration marks the
// instance unhealthy, so Railway does not promote it (the last-good deploy keeps serving) and the
// failure is a visible failed-deploy, not a silent auth outage. A later deploy/restart re-runs the
// (idempotent) migration once the DB is reachable. Reading the flag is a cheap boolean — the probe
// stays I/O-free and never flaps.
let authMigrationFailed = false;

export function markAuthMigrationFailed(): void {
  authMigrationFailed = true;
}

export function markAuthMigrationOk(): void {
  authMigrationFailed = false;
}

export function isAuthMigrationHealthy(): boolean {
  return !authMigrationFailed;
}

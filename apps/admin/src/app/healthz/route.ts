// Railway readiness probe (ADR-0114/0138). Mirrors apps/site's `/healthz` — no DB round-trip (the
// admin's own routes prove DB connectivity per-request; the probe itself must stay cheap so it never
// flaps on a slow query). The ONE gate it honors is the boot-migration flag (CAISSON-48): if the
// better-auth migration failed at boot, this reports 503 so Railway fails the deploy closed rather
// than promote a control-plane whose every OAuth callback 500s. Reading the flag is a cheap boolean.
//
// CAISSON-37 (F-1 residual): also reports the baked registry/index.json digest — the admin leg of
// registry/scripts/index-parity-probe.ts's three-way parity check (repo file / license service /
// admin), queued behind the admin GitHub-OAuth migration (ADR-0283, now merged). Mirrors
// services/license/src/server.ts's `/health` field exactly: sha256 first-12-hex of the file
// BYTES, read from the same `CAISSON_REGISTRY_INDEX_PATH` env var `registryIndex()` in
// admin-mutations-runtime.ts uses (set by apps/admin/Dockerfile to /app/registry/index.json in
// production). Read directly here rather than via that cached, DB-adjacent helper — this route
// hashes raw bytes and must stay dependency-light. A missing/unreadable index file must never flap
// Railway's readiness gate, so the fields are simply omitted rather than turning `ok` false.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isAuthMigrationHealthy } from "../../lib/admin-boot-state.ts";

export const dynamic = "force-dynamic";

function registryIndexDigest():
  { indexDigest: string; indexEntries: number } | undefined {
  try {
    const path =
      process.env.CAISSON_REGISTRY_INDEX_PATH?.trim() ||
      join(process.cwd(), "registry", "index.json");
    const bytes = readFileSync(path);
    const parsed = JSON.parse(bytes.toString("utf8")) as {
      modules?: unknown[];
    };
    return {
      indexDigest: createHash("sha256")
        .update(bytes)
        .digest("hex")
        .slice(0, 12),
      indexEntries: Array.isArray(parsed.modules) ? parsed.modules.length : 0,
    };
  } catch {
    return undefined;
  }
}

export function GET(): Response {
  const ok = isAuthMigrationHealthy();
  return new Response(
    JSON.stringify({ ok, ...(registryIndexDigest() ?? {}) }),
    {
      status: ok ? 200 : 503,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    },
  );
}

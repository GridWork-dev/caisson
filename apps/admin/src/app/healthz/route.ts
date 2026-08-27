// Railway readiness probe (ADR-0114/0138). Mirrors apps/site's `/healthz` — no DB round-trip (the
// admin's own routes prove DB connectivity per-request; the probe itself must stay cheap so it never
// flaps on a slow query). Schema migration is an explicit finite Job and never part of process boot.
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
import {
  loadOriginGateConfig,
  originRequestAuthorized,
} from "@caisson/kernel/node";

export const dynamic = "force-dynamic";

function registryIndexDigest():
  | { indexDigest: string; indexEntries: number }
  | undefined {
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

// ADR-0416 ruling 1: this path answers ahead of both edge layers so Railway's internal probe can
// reach it, which means an unauthenticated raw *.up.railway.app caller reaches it too. The digest
// therefore rides only for callers that proved the origin secret — index-parity-probe.ts reaches
// admin.caisson.sh THROUGH the Worker, which injects it, so the parity leg is unaffected. Checked
// here rather than threaded from the proxy: the proxy exempts this path before it ever evaluates
// the gate, so the request arrives with nothing recorded about its origin.
export function GET(request: Request): Response {
  const authorized = originRequestAuthorized(
    request,
    loadOriginGateConfig(process.env),
  );
  return new Response(
    JSON.stringify({
      ok: true,
      ...(authorized ? (registryIndexDigest() ?? {}) : {}),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    },
  );
}

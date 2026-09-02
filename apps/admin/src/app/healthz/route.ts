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
// reach it, which means an unauthenticated raw *.up.railway.app caller reaches it too — that half
// of ruling 1 (the health-path carve itself) stands unchanged. What ADR-0417 supersedes is the
// OTHER half: ruling 1 also gated the digest on the origin secret, and that gate was vacuous. The
// secret proves PROVENANCE — that a request arrived through the Cloudflare Worker — not
// authentication of who sent it, and the Worker injects the secret into every edge request, so
// every public caller on admin.caisson.sh is already "authorized" by construction. Gating withheld
// the field from exactly one class (a direct-to-origin *.up.railway.app caller) while the front
// door handed it to the entire internet; there was also no secret to protect, since the digest is
// a sha256-first-12 of registry/index.json, a file the registry Worker already serves publicly at
// registry.caisson.sh. Measured 2026-09-01: the raw origin previously returned bare {ok:true}
// while the edge path returned the digest for the identical file. Publish it to every caller;
// `registryIndexDigest()`'s own fail-closed-to-undefined (an unreadable/missing index) is what
// still legitimately omits the field, and stays the only thing that does.
export function GET(_request: Request): Response {
  return new Response(
    JSON.stringify({
      ok: true,
      ...(registryIndexDigest() ?? {}),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    },
  );
}

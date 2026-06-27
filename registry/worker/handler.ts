// Registry read Worker — a DEFERRED SEAM (ADR-0047). A thin Cloudflare Worker that serves the
// CI-built registry index at the edge. Wave 0 ships the typed, unit-tested fetch handler + wrangler
// config; it is NOT deployed — real edge serving, caching, and entitlement filtering are P5/P6. The
// index stays the static, CI-built source of truth + allowlist; this only fronts it for reads.
//
// Entitlement (knowing a module ≠ being entitled to it, ADR-0008) is a SEPARATE request-time gate
// the buyer MCP enforces at P6 — see the `// P6:` hook below. No entitlement logic ships here.
import {
  type RegistryIndex,
  assertKnownModule,
  loadRegistryIndex,
} from "../schema/registry-index";

const JSON_HEADERS: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
  "cache-control": "public, max-age=60",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/**
 * Build the read handler over a parsed, validated index. Routes:
 *   GET /              → schemaVersion + module ids (a light catalog listing)
 *   GET /index.json    → the full index
 *   GET /modules/:id   → one module entry (404 if not in the allowlist)
 * Any other method/path → 405 / 404.
 */
export function createIndexHandler(
  index: RegistryIndex,
): (request: Request) => Response {
  // Re-validate once so a caller can't pass an unparsed object past the type (parse-or-throw).
  const validated = loadRegistryIndex(index);

  return (request: Request): Response => {
    if (request.method !== "GET")
      return json({ error: "method_not_allowed" }, 405);
    const url = new URL(request.url);
    const path = url.pathname;

    // P6: entitlement gate — filter `validated` to the caller's entitled modules here (ADR-0008).
    // Wave 0 serves the full allowlist unfiltered; the hook is intentionally a no-op.

    if (path === "/" || path === "") {
      return json({
        schemaVersion: validated.schemaVersion,
        modules: validated.modules.map((m) => ({ id: m.id, latest: m.latest })),
      });
    }
    if (path === "/index.json") return json(validated);

    const modMatch = /^\/modules\/(.+)$/.exec(path);
    if (modMatch) {
      let id: string;
      try {
        // decodeURIComponent throws URIError on malformed %-encoding (e.g. `/modules/%ZZ`) — it
        // MUST be inside the guard, else the handler 500s instead of returning 404.
        id = decodeURIComponent(modMatch[1] as string);
        assertKnownModule(validated, id); // throws on malformed OR unknown id
      } catch {
        return json({ error: "unknown_module" }, 404);
      }
      const entry = validated.modules.find((m) => m.id === id);
      return json(entry);
    }
    return json({ error: "not_found" }, 404);
  };
}

/**
 * Cloudflare Worker entry (deferred). In production the index arrives bundled or from a KV/R2
 * binding; for the seam, a deployment supplies it via `env.REGISTRY_INDEX` (JSON). Unwired here so
 * CI builds + tests the handler without a Workers runtime.
 */
export interface WorkerEnv {
  REGISTRY_INDEX?: string;
}

export default {
  fetch(request: Request, env: WorkerEnv): Response {
    if (env.REGISTRY_INDEX === undefined) {
      return json(
        { error: "registry index not configured (deferred seam, ADR-0047)" },
        503,
      );
    }
    const index = loadRegistryIndex(JSON.parse(env.REGISTRY_INDEX));
    return createIndexHandler(index)(request);
  },
};

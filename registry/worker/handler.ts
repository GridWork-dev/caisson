// Registry read Worker (ADR-0047). A thin Cloudflare Worker that serves the CI-built registry index
// at the edge. The index stays the static, CI-built source of truth + allowlist; this fronts it for
// reads and — at P6 (B2) — filters each response to what the caller is ENTITLED to.
//
// Entitlement filtering (ADR-0008/0071): a request may carry a signed license; an injected
// `resolveEntitlements` turns it into the caller's PURCHASED IDS (editions/bundle/modules), which are
// expanded against this index (`expandEntitlements`) and unioned with the free Apache-2.0 base
// (`baseModuleIds`, ADR-0094 — always served). A community/unlicensed caller sees base only; a module
// the caller is not entitled to is 404 — invisible, indistinguishable from unknown (the same
// fail-closed posture as the buyer MCP, ADR-0076). When no resolver is injected the handler serves the
// full PUBLIC catalog unfiltered (the Wave-0 contract; handler.test.ts pins it). The Ed25519 verify
// that drives the resolver lives in entitlement-filter.ts; deploy-entry.ts wires it for the live edge.
import {
  type RegistryIndex,
  assertKnownModule,
  baseModuleIds,
  expandEntitlements,
  loadRegistryIndex,
} from "../schema/registry-index";

/**
 * Per-request entitlement source. Returns the caller's PURCHASED IDS from a verified license, or
 * `null` for an unlicensed/community caller. SHOULD be total, but it need not be: the handler runs it
 * INSIDE the fail-safe boundary, so even a throwing resolver degrades to the community (base-only)
 * view, never a 500. When this option is omitted the handler serves the full unfiltered public catalog.
 */
export interface IndexHandlerOptions {
  resolveEntitlements?: (request: Request) => readonly string[] | null;
}

function jsonHeaders(filtering: boolean): Record<string, string> {
  return {
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    // A FILTERED response varies by caller — it must never be served from a shared cache to a
    // different buyer. Public-catalog mode (no resolver) stays edge-cacheable.
    "cache-control": filtering ? "private, no-store" : "public, max-age=60",
    ...(filtering ? { vary: "Authorization" } : {}),
  };
}

function json(body: unknown, status: number, filtering: boolean): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders(filtering),
  });
}

/**
 * The caller's entitled module-id set for a filtered request: the free base (ADR-0094, always served)
 * ∪ the expansion of the caller's purchased ids. Fail-SAFE: ANY error — a throwing resolver, a
 * malformed token, or a stale entitlement no longer in the index (`expandEntitlements` throws on an
 * unknown id) — degrades to base-only, NEVER a 500. The resolver is called INSIDE the guard so its
 * total-safety does not rely on the injected implementation. `null` purchased ids = community = base.
 */
function entitledModuleSet(
  index: RegistryIndex,
  resolve: (request: Request) => readonly string[] | null,
  request: Request,
): Set<string> {
  const entitled = new Set<string>(baseModuleIds(index));
  try {
    const purchased = resolve(request);
    if (purchased === null) return entitled;
    for (const id of expandEntitlements(index, purchased)) entitled.add(id);
  } catch {
    // A throwing resolver OR a stale/forged entitlement → keep the safe base-only view (no crash).
  }
  return entitled;
}

/**
 * Build the read handler over a parsed, validated index. Routes:
 *   GET /              → schemaVersion + module ids (a light catalog listing)
 *   GET /index.json    → the full index
 *   GET /modules/:id   → one module entry (404 if not in the allowlist OR not entitled)
 * Any other method/path → 405 / 404. With `options.resolveEntitlements`, every response is filtered
 * to the caller's entitled set (base ∪ expanded purchases); without it, the full catalog is served.
 */
export function createIndexHandler(
  index: RegistryIndex,
  options: IndexHandlerOptions = {},
): (request: Request) => Response {
  // Re-validate once so a caller can't pass an unparsed object past the type (parse-or-throw).
  const validated = loadRegistryIndex(index);
  const resolve = options.resolveEntitlements;
  const filtering = resolve !== undefined;

  return (request: Request): Response => {
    if (request.method !== "GET")
      return json({ error: "method_not_allowed" }, 405, filtering);
    const url = new URL(request.url);
    const path = url.pathname;

    // Entitlement gate (ADR-0008/0071): compute the caller's entitled module set, or `null` when no
    // resolver is configured (serve everything). The resolver runs inside entitledModuleSet's
    // fail-safe boundary, so a throw degrades to base-only rather than 500ing the edge.
    const entitled: Set<string> | null =
      resolve === undefined
        ? null
        : entitledModuleSet(validated, resolve, request);

    if (path === "/" || path === "") {
      const modules = validated.modules
        .filter((m) => entitled === null || entitled.has(m.id))
        .map((m) => ({ id: m.id, latest: m.latest }));
      return json(
        { schemaVersion: validated.schemaVersion, modules },
        200,
        filtering,
      );
    }
    if (path === "/index.json") {
      const body =
        entitled === null
          ? validated
          : {
              ...validated,
              modules: validated.modules.filter((m) => entitled.has(m.id)),
            };
      return json(body, 200, filtering);
    }

    const modMatch = /^\/modules\/(.+)$/.exec(path);
    if (modMatch) {
      let id: string;
      try {
        // decodeURIComponent throws URIError on malformed %-encoding (e.g. `/modules/%ZZ`) — it
        // MUST be inside the guard, else the handler 500s instead of returning 404.
        id = decodeURIComponent(modMatch[1] as string);
        assertKnownModule(validated, id); // throws on malformed OR unknown id
      } catch {
        return json({ error: "unknown_module" }, 404, filtering);
      }
      // A known module the caller is not entitled to is 404 — invisible, indistinguishable from an
      // unknown id (ADR-0076 fail-closed: never leak that an unentitled module exists).
      if (entitled !== null && !entitled.has(id)) {
        return json({ error: "unknown_module" }, 404, filtering);
      }
      const entry = validated.modules.find((m) => m.id === id);
      return json(entry, 200, filtering);
    }
    return json({ error: "not_found" }, 404, filtering);
  };
}

/**
 * Cloudflare Worker entry (deferred seam). In production the index arrives bundled (deploy-entry.ts)
 * or from a KV/R2 binding; for the seam, a deployment supplies it via `env.REGISTRY_INDEX` (JSON).
 * This entry serves UNFILTERED — the live deploy uses deploy-entry.ts, which wires the entitlement
 * resolver. Unwired here so CI builds + tests the handler without a Workers runtime.
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
        false,
      );
    }
    const index = loadRegistryIndex(JSON.parse(env.REGISTRY_INDEX));
    return createIndexHandler(index)(request);
  },
};

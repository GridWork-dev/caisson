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
import { bundleMembershipTimeline } from "@caisson/pricebook";
import {
  BUNDLE_IDS,
  type EntitlementSnapshot,
  type RegistryIndex,
  assertKnownModule,
  baseModuleIds,
  expandEntitlements,
  loadRegistryIndex,
} from "../schema/registry-index";

/**
 * The full bundle-membership TIMELINE (ADR-0247 F7 / ADR-0257 §1.2), built ONCE from
 * `@caisson/pricebook` — the DATA half of the snapshot-at-sale member filter. `@caisson/registry-schema`
 * (the open Apache base) never depends "up" on the commercial pricebook that owns this data, so the
 * gate INJECTS it here (the D side of the D/E boundary — E owns the per-version window at this edge;
 * D owns this per-member join-date filter). Static, so it is computed once at module load.
 */
const MEMBERSHIP_TIMELINE: Record<
  string,
  Readonly<Record<string, string>>
> = Object.fromEntries(
  BUNDLE_IDS.map((id) => [id, bundleMembershipTimeline(id)]),
);

/**
 * A resolved license: the caller's PURCHASED IDS plus the signed ADR-0244/0255 per-entitlement
 * updates windows (`updatesWindows`, `purchasedEntitlementId → ISO instant`) and the ADR-0257 §1.2
 * `entitledSince` snapshot-at-sale instants (the member-set axis). An entitlement id ABSENT from a
 * map is unbounded/grandfathered — there are never `null` values in either map.
 */
export interface ResolvedLicense {
  readonly entitlements: readonly string[];
  readonly updatesWindows: Readonly<Record<string, string>>;
  // Optional: an absent map (an older resolver, or a test double that doesn't exercise the member
  // axis) reads as every bundle grandfathered — the same fail-soft default the schema filter uses.
  // The live edge resolver (entitlement-filter.ts) always sets it.
  readonly entitledSince?: Readonly<Record<string, string>>;
}

/**
 * What a resolver may return: the bare purchased-id array (the pre-window contract, kept so injected
 * test doubles stay valid — reads as every entitlement unbounded) or a {@link ResolvedLicense}
 * carrying the per-entitlement updates windows. The live edge resolver (entitlement-filter.ts) always
 * returns the object form.
 */
export type ResolvedEntitlements = readonly string[] | ResolvedLicense;

/** Narrow the union — `Array.isArray` alone does not narrow a `readonly string[]` union member. */
const isBareList = (r: ResolvedEntitlements): r is readonly string[] =>
  Array.isArray(r);

/**
 * Per-request entitlement source. Returns the caller's resolved entitlements, or `null` for an
 * unlicensed/community caller. SHOULD be total, but it need not be: the handler runs it
 * INSIDE the fail-safe boundary, so even a throwing resolver degrades to the community (base-only)
 * view, never a 500. When this option is omitted the handler serves the full unfiltered public catalog.
 */
export interface IndexHandlerOptions {
  resolveEntitlements?: (request: Request) => ResolvedEntitlements | null;
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
 * Unauthenticated liveness response for the public uptime monitor (ADR-0348). `version` is the
 * registry schema version the handler already validated at construction — the cheapest version
 * source in scope, no R2/KV read. Reuses the standard security headers but forces `cache-control:
 * no-store` (and carries no `Vary`) so a monitor never reads a cached body and the route can never
 * leak a caller-filtered response.
 */
function health(version: number): Response {
  return new Response(JSON.stringify({ status: "ok", version }), {
    status: 200,
    headers: { ...jsonHeaders(false), "cache-control": "no-store" },
  });
}

/**
 * The gate result: the caller's entitled module ids + a per-module updates-window lookup
 * (ADR-0255). `windowFor(moduleId)` returns `null` for unbounded (the caller decides applicability —
 * base modules are never window-filtered regardless of what this returns).
 */
export interface ResolvedGate {
  readonly entitled: Set<string>;
  readonly windowFor: (moduleId: string) => string | null;
}

const UNBOUNDED = () => null;

/**
 * The caller's entitled module-id set for a filtered request: the free base (ADR-0094, always served)
 * ∪ the expansion of the caller's purchased ids — plus, per member module, the MOST FAVORABLE of the
 * ADR-0244/0255 updates windows among the purchased ids that grant it (unbounded wins; else the max
 * instant — owning a module à-la-carte and via an edition means the better window applies, ADR-0255
 * Decision 3). Fail-SAFE: ANY error — a throwing resolver, a malformed token, or a stale entitlement
 * no longer in the index (`expandEntitlements` throws on an unknown id) — degrades to base-only,
 * NEVER a 500 (base is never window-filtered, so the degraded window is moot). The resolver is
 * called INSIDE the guard so its total-safety does not rely on the injected implementation.
 * `null` resolved = community = base. Shared with the npm surface (npm-routes.ts) — ONE gate math.
 */
export function resolveGate(
  index: RegistryIndex,
  resolve: (request: Request) => ResolvedEntitlements | null,
  request: Request,
): ResolvedGate {
  const entitled = new Set<string>(baseModuleIds(index));
  try {
    const resolved = resolve(request);
    if (resolved === null) return { entitled, windowFor: UNBOUNDED };
    const purchased = isBareList(resolved) ? resolved : resolved.entitlements;
    const updatesWindows = isBareList(resolved) ? {} : resolved.updatesWindows;
    // ADR-0257 §1.2 snapshot-at-sale: fold the caller's signed `entitledSince` with the pricebook
    // membership timeline so a bundle member that joined AFTER the buyer's sale instant is dropped
    // (fail-soft — an absent key grandfathers the bundle). A bare-list resolver double carries no
    // snapshot → the empty map = no member filtering (the pre-snapshot contract).
    const snapshot: EntitlementSnapshot = {
      entitledSince: isBareList(resolved) ? {} : (resolved.entitledSince ?? {}),
      membershipTimeline: MEMBERSHIP_TIMELINE,
    };
    for (const id of expandEntitlements(index, purchased, snapshot))
      entitled.add(id);

    // Per-module most-favorable window: for each purchased id, find what it grants + its own window
    // (absent key = unbounded), then fold into the per-module map (unbounded wins; else the max
    // instant). Every `grantorId` here already passed the batch `expandEntitlements` above, so a
    // per-id re-expansion cannot newly throw. The SAME snapshot filters each per-id expansion, so a
    // snapshot-excluded member never gets a window entry (it is not in `entitled` either).
    const moduleWindows = new Map<string, string | null>();
    for (const grantorId of purchased) {
      const window = Object.hasOwn(updatesWindows, grantorId)
        ? (updatesWindows[grantorId] ?? null)
        : null;
      for (const memberId of expandEntitlements(index, [grantorId], snapshot)) {
        const existing = moduleWindows.get(memberId);
        if (existing === undefined) {
          moduleWindows.set(memberId, window);
        } else if (existing !== null && window !== null) {
          moduleWindows.set(
            memberId,
            Date.parse(window) > Date.parse(existing) ? window : existing,
          );
        } else {
          moduleWindows.set(memberId, null); // either grantor unbounded → unbounded wins
        }
      }
    }
    return {
      entitled,
      windowFor: (moduleId: string) => moduleWindows.get(moduleId) ?? null,
    };
  } catch {
    // A throwing resolver OR a stale/forged entitlement → a FRESH base-only view (no crash). Never
    // return the in-progress `entitled` set: expansion mutates it before the window fold, so a
    // future post-expansion throw would otherwise degrade to commercial modules with UNBOUNDED
    // windows (a version-window bypass for an entitled caller).
    return {
      entitled: new Set<string>(baseModuleIds(index)),
      windowFor: UNBOUNDED,
    };
  }
}

/** One index module entry (the /modules/:id + packument unit the window filter narrows). */
type ModuleEntry = RegistryIndex["modules"][number];

/**
 * Narrow a COMMERCIAL module entry to the versions inside the caller's updates window
 * (ADR-0244/0255): keep `publishedAt <= cutoff`, recompute `latest` to the newest IN-WINDOW version
 * (the index `latest` if it survived, else the max `publishedAt` survivor). Returns `null` when NO
 * version is in-window — the caller was never entitled to any published version, indistinguishable
 * from unentitled (fail-closed, ADR-0076). An unparseable bound filters everything (fail-closed). The
 * caller decides applicability: base/community modules are NEVER window-filtered (the window
 * governs entitled commercial pulls only). `cutoff` is the per-module MOST-FAVORABLE ISO instant the
 * caller (`resolveGate`) already resolved — this function itself has no notion of entitlement ids.
 */
export function windowFilterEntry(
  entry: ModuleEntry,
  cutoff: string,
): ModuleEntry | null {
  const bound = Date.parse(cutoff);
  const versions = entry.versions.filter(
    (v) => Date.parse(v.publishedAt) <= bound,
  );
  let newest = versions[0];
  if (newest === undefined) return null;
  for (const v of versions) {
    if (Date.parse(v.publishedAt) > Date.parse(newest.publishedAt)) newest = v;
  }
  const latest = versions.some((v) => v.version === entry.latest)
    ? entry.latest
    : newest.version;
  return { ...entry, latest, versions };
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
  // The free base is NEVER window-filtered (ADR-0251: the window governs entitled COMMERCIAL pulls).
  const baseIds = new Set<string>(baseModuleIds(validated));

  return (request: Request): Response => {
    if (request.method !== "GET")
      return json({ error: "method_not_allowed" }, 405, filtering);
    const url = new URL(request.url);
    const path = url.pathname;

    // Liveness probe — served BEFORE the entitlement gate so it never runs the resolver, scans the
    // index, or reads R2. A fixed 200 for the public uptime monitor (ADR-0348).
    if (path === "/health") return health(validated.schemaVersion);

    // Entitlement gate (ADR-0008/0071): compute the caller's entitled module set + per-module
    // updates window, or `null` when no resolver is configured (serve everything). The resolver runs
    // inside resolveGate's fail-safe boundary, so a throw degrades to base-only rather than 500ing.
    const gate: ResolvedGate | null =
      resolve === undefined ? null : resolveGate(validated, resolve, request);
    const entitled = gate === null ? null : gate.entitled;
    // Catalog listings apply the same PER-MODULE window math as /modules/:id and the npm surface
    // (ADR-0255) — a fully-out-of-window module vanishes from the listing and `latest` never
    // advertises a version the packument/tarball gates would refuse (metadata↔pull consistency).
    const windowed = (m: ModuleEntry): ModuleEntry | null => {
      if (gate === null || baseIds.has(m.id)) return m;
      const cutoff = gate.windowFor(m.id);
      return cutoff === null ? m : windowFilterEntry(m, cutoff);
    };

    if (path === "/" || path === "") {
      const modules = validated.modules
        .filter((m) => entitled === null || entitled.has(m.id))
        .map(windowed)
        .filter((m): m is ModuleEntry => m !== null)
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
              modules: validated.modules
                .filter((m) => entitled.has(m.id))
                .map(windowed)
                .filter((m): m is ModuleEntry => m !== null),
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
      let entry = validated.modules.find((m) => m.id === id);
      // Per-module updates-window filter (ADR-0244/0255): an entitled COMMERCIAL module serves only
      // versions inside its MOST FAVORABLE window, with `latest` recomputed to the newest in-window
      // version. Base modules and an unbounded window are untouched (the shared `windowed` helper).
      // A module with NO in-window version is 404 — same invisibility as unentitled.
      if (entry !== undefined) {
        const narrowed = windowed(entry);
        if (narrowed === null) {
          return json({ error: "unknown_module" }, 404, filtering);
        }
        entry = narrowed;
      }
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

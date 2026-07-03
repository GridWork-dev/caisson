// Registry read Worker — DEPLOY entry (ADR-0047 seam → live). The seam in handler.ts deliberately
// kept the index OUT of the bundle: its default export reads env.REGISTRY_INDEX and 503s when unset,
// so Wave 0 could ship + unit-test the router (createIndexHandler) without committing to a delivery
// mechanism. This entry closes that seam for the real deploy by inlining the CI-built
// registry/index.json straight into the Worker bundle — esbuild (via wrangler) bakes the JSON in at
// build time. The result: NO env var, NO KV/R2 binding, NO 503 path, and no binding-size limit on the
// ~8KB index. handler.ts + its env.REGISTRY_INDEX contract + handler.test.ts are left UNTOUCHED and
// still valid; this file is the deploy-only composition root.
//
// Entitlement filtering (ADR-0008/0071) IS wired here (code-wiring B2): the live edge verifies the
// caller's license offline (licenseEntitlementResolver) and serves only base ∪ their entitled
// editions. This CHANGES the live behavior at the next DEPLOY (operator-gated, separate from SHIP): an
// anonymous/community caller then sees only the free Apache-2.0 base; a licensed buyer sees base + the
// editions they bought; an unentitled module is 404. Until redeployed, the running Worker keeps its
// current unfiltered behavior. The index itself stays the CI-built public source of truth (no secrets).
import index from "../index.json";
import { loadRegistryIndex } from "../schema/registry-index";
import { makeLicenseEntitlementResolver } from "./entitlement-filter";
import { createIndexHandler } from "./handler";
import { makeRevocationDenySet } from "./revocation-list";

// Edge revocation deny-set (ADR-0225 R-4=B). The operator revoke mutation republishes the full set of
// revoked license ids to a fixed R2 object; the Worker reads it on a short TTL and denies those license
// ids at the edge. Structural (not @cloudflare/workers-types) so the worker keeps zero runtime deps. The
// R2 binding is operator-gated at DEPLOY — absent here → the fetcher throws → the cache fails OPEN
// (empty deny-set, nothing denied), so installs never break before the binding is provisioned.
interface R2ObjectLike {
  json(): Promise<unknown>;
}
interface R2BucketLike {
  get(key: string): Promise<R2ObjectLike | null>;
}
interface DeployEnv {
  REVOCATIONS?: R2BucketLike;
}
interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

const REVOCATION_KEY = "revocations/deny-set.json";
const REVOCATION_TTL_MS = 60_000;

// ponytail: a per-isolate env ref. Workers bindings are constant for the life of an isolate, so this is
// effectively assign-once — the deny-set fetcher needs env, which only arrives per-request.
let boundEnv: DeployEnv = {};
const denySet = makeRevocationDenySet(async (): Promise<unknown> => {
  const obj = await boundEnv.REVOCATIONS?.get(REVOCATION_KEY);
  if (obj === null || obj === undefined)
    throw new Error("revocation deny-set unavailable"); // → cache fails open (empty set)
  return obj.json();
}, REVOCATION_TTL_MS);

// Parse-or-throw at module load (cold start) over the bundled JSON: a tampered/malformed bundle fails
// loudly rather than serving a half-typed object. createIndexHandler re-validates as defense in depth
// (its own contract); the redundant parse over a handful of modules is negligible and intentional.
const handler = createIndexHandler(loadRegistryIndex(index), {
  resolveEntitlements: makeLicenseEntitlementResolver(denySet.get),
});

export default {
  fetch(
    request: Request,
    env: DeployEnv = {},
    ctx?: ExecutionContextLike,
  ): Response {
    boundEnv = env;
    // Stale-while-revalidate: kick a background refresh, NEVER await it before serving — a slow/failing
    // deny-set fetch must not add latency or block the response (fail-open).
    ctx?.waitUntil(denySet.maybeRefresh());
    return handler(request);
  },
};

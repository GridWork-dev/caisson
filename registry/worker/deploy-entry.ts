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
import tarballs from "../tarballs.json";
import { loadRegistryIndex } from "../schema/registry-index";
import { makeLicenseEntitlementResolver } from "./entitlement-filter";
import { createIndexHandler } from "./handler";
import {
  type NpmEnv,
  createNpmHandler,
  isNpmPath,
  loadTarballSidecar,
} from "./npm-routes";
import {
  type RateLimiterBinding,
  rateLimit,
  rateLimitedResponse,
} from "./rate-limit";
import { makeRevocationDenySet } from "./revocation-list";
import {
  REVOCATION_OBJECT_KEY,
  type R2PutBucketLike,
  handleRevocationPut,
  isRevocationPutRequest,
} from "./revocations-put";

// Edge revocation deny-set (ADR-0225 R-4=B). The operator revoke mutation republishes the full set of
// revoked license ids to a fixed R2 object; the Worker reads it on a short TTL and denies those license
// ids at the edge. Structural (not @cloudflare/workers-types) so the worker keeps zero runtime deps. The
// R2 binding is operator-gated at DEPLOY — absent here → the fetcher throws → the cache fails OPEN
// (empty deny-set, nothing denied), so installs never break before the binding is provisioned.
interface R2ObjectLike {
  json(): Promise<unknown>;
}
interface R2BucketLike extends R2PutBucketLike {
  get(key: string): Promise<R2ObjectLike | null>;
}
interface DeployEnv {
  REVOCATIONS?: R2BucketLike;
  /** The publisher shim's bearer (worker secret, ADR-0225 R-4=B). Unset ⇒ the PUT route 404s. */
  REVOCATIONS_PUT_TOKEN?: string;
  /** R2 tarball binding for the npm surface (ADR-0223); absent → npm tarball routes 503. */
  TARBALLS?: NpmEnv["TARBALLS"];
  /** Native Cloudflare Rate Limiting bindings (CAISSON-55, wrangler.toml `[[ratelimits]]`) — one
   *  independent namespace per route class. Absent → that class's checks fail open (rate-limit.ts). */
  RATE_LIMIT_CATALOG?: RateLimiterBinding;
  RATE_LIMIT_NPM_PACKUMENT?: RateLimiterBinding;
  RATE_LIMIT_TARBALL?: RateLimiterBinding;
}
interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

// Reader key derived from the writer's exported constant — ONE source (the reader fails open,
// so a silent key drift would disable every revoke with no error signal; LOW-2 of the shim audit).
const REVOCATION_KEY = REVOCATION_OBJECT_KEY;
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

// ONE deny-set-wired resolver gates BOTH surfaces — the npm install channel (ADR-0223) is exactly
// what a revoked license must lose, so it cannot bypass the edge deny-set (ADR-0225 R-4=B).
// The factory is exported ONLY so tests can compose the LIVE denySet.get with a runtime-minted
// dev-key verifier (no committed prod token — the P0 incident class); it is inert at the edge
// (Worker modules are not externally importable) and every shipped call site takes the baked default.
export const buildLicenseEntitlementResolver = (
  verify?: Parameters<typeof makeLicenseEntitlementResolver>[1],
): ReturnType<typeof makeLicenseEntitlementResolver> =>
  makeLicenseEntitlementResolver(denySet.get, verify);
const licenseEntitlementResolver = buildLicenseEntitlementResolver();

// Parse-or-throw at module load (cold start) over the bundled JSON: a tampered/malformed bundle fails
// loudly rather than serving a half-typed object. createIndexHandler re-validates as defense in depth
// (its own contract); the redundant parse over a handful of modules is negligible and intentional.
const handler = createIndexHandler(loadRegistryIndex(index), {
  resolveEntitlements: licenseEntitlementResolver,
});

// npm-protocol surface (ADR-0223) — additive. The SAME injected license resolver gates it, over the
// same inlined index + the git-tracked tarball sidecar (Fork 1.1, inlined like index.json).
const npmHandler = createNpmHandler(
  loadRegistryIndex(index),
  loadTarballSidecar(tarballs),
  { resolveEntitlements: licenseEntitlementResolver },
);

export default {
  async fetch(
    request: Request,
    env: DeployEnv = {},
    ctx?: ExecutionContextLike,
  ): Promise<Response> {
    boundEnv = env;
    // Stale-while-revalidate: kick a background refresh, NEVER await it before serving — a slow/failing
    // deny-set fetch must not add latency or block the response (fail-open).
    ctx?.waitUntil(denySet.maybeRefresh());
    const { pathname } = new URL(request.url);
    // Deny-set publisher shim (ADR-0225 R-4=B): the ONE write surface on this Worker — exact
    // path + PUT only, bearer-gated + Zod-strict inside, 404 until the secret + binding are
    // provisioned. Everything else on this Worker stays read-only.
    if (isRevocationPutRequest(request.method, pathname)) {
      return handleRevocationPut(request, env);
    }
    if (isNpmPath(pathname)) {
      // The npm surface's OWN route-class rate limits (packument vs tarball, CAISSON-55) are wired
      // inside createNpmHandler itself — see npm-routes.ts, which distinguishes the two before its
      // entitlement gate. Both bindings ride the same env object as TARBALLS; all three are optional
      // and independently fail open (rate-limit.ts) when not yet provisioned at DEPLOY.
      return npmHandler(request, {
        TARBALLS: env.TARBALLS,
        RATE_LIMIT_NPM_PACKUMENT: env.RATE_LIMIT_NPM_PACKUMENT,
        RATE_LIMIT_TARBALL: env.RATE_LIMIT_TARBALL,
      });
    }
    // Catalog-class rate limit (CAISSON-55), BEFORE the entitlement gate that `handler(request)` runs:
    // wired here rather than inside handler.ts's createIndexHandler because that function is a widely
    // reused SYNC pure function (handler.test.ts + handler-filter.test.ts drive it directly, ~50 call
    // sites) — making it async to await a per-request binding call would rewrite every one of those
    // call sites for no behavioral gain, since this dispatcher is the ONE place every catalog request
    // already passes through before reaching it. Fail-open (missing binding / limiter error) is
    // rate-limit.ts's job; a genuine deny short-circuits before the (comparatively expensive)
    // entitlement resolve + index filtering below ever runs.
    const rl = await rateLimit(env.RATE_LIMIT_CATALOG, request);
    if (!rl.ok) return rateLimitedResponse();
    return handler(request);
  },
};

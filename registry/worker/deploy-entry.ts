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
import { licenseEntitlementResolver } from "./entitlement-filter";
import { createIndexHandler } from "./handler";
import {
  type NpmEnv,
  createNpmHandler,
  isNpmPath,
  loadTarballSidecar,
} from "./npm-routes";

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
  fetch(request: Request, env?: NpmEnv): Response {
    const { pathname } = new URL(request.url);
    if (isNpmPath(pathname)) {
      // The npm surface is async (R2 tarball reads); Cloudflare awaits a returned promise. The
      // untouched deploy-entry.test.ts only exercises the sync index path below, which keeps the
      // `: Response` contract — the npm branch hands back a Promise the workerd runtime awaits.
      return npmHandler(request, env) as unknown as Response;
    }
    return handler(request);
  },
};

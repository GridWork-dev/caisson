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
import { licenseEntitlementResolver } from "./entitlement-filter";
import { createIndexHandler } from "./handler";

// Parse-or-throw at module load (cold start) over the bundled JSON: a tampered/malformed bundle fails
// loudly rather than serving a half-typed object. createIndexHandler re-validates as defense in depth
// (its own contract); the redundant parse over a handful of modules is negligible and intentional.
const handler = createIndexHandler(loadRegistryIndex(index), {
  resolveEntitlements: licenseEntitlementResolver,
});

export default {
  fetch(request: Request): Response {
    return handler(request);
  },
};

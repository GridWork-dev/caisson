// Registry read Worker — DEPLOY entry (ADR-0047 seam → live). The seam in handler.ts deliberately
// kept the index OUT of the bundle: its default export reads env.REGISTRY_INDEX and 503s when unset,
// so Wave 0 could ship + unit-test the router (createIndexHandler) without committing to a delivery
// mechanism. This entry closes that seam for the real deploy by inlining the CI-built
// registry/index.json straight into the Worker bundle — esbuild (via wrangler) bakes the JSON in at
// build time. The result: NO env var, NO KV/R2 binding, NO 503 path, and no binding-size limit on the
// ~8KB index. handler.ts + its env.REGISTRY_INDEX contract + handler.test.ts are left UNTOUCHED and
// still valid; this file is the deploy-only composition root.
//
// Entitlement filtering (knowing a module ≠ being entitled to it, ADR-0008) remains a SEPARATE P6
// request-time gate — none ships here. This serves the full PUBLIC allowlist index, which is already
// the CI-built source of truth (no secrets).
import index from "../index.json";
import { loadRegistryIndex } from "../schema/registry-index";
import { createIndexHandler } from "./handler";

// Parse-or-throw at module load (cold start) over the bundled JSON: a tampered/malformed bundle fails
// loudly rather than serving a half-typed object. createIndexHandler re-validates as defense in depth
// (its own contract); the redundant parse over a handful of modules is negligible and intentional.
const handler = createIndexHandler(loadRegistryIndex(index));

export default {
  fetch(request: Request): Response {
    return handler(request);
  },
};

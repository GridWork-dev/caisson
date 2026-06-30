// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "base"` — the open registry CONTRACT (manifest + index
// schema + allowlist helpers + feature-tags + entitlement-expansion), zod/fs-only. Open-core
// Apache-2.0 (ADR-0094/0097): the non-differentiating contract is open; the commercial
// @caisson/registry SERVICE (worker + index-builder + publish) re-exports it.
//
// tier `oss` + no priceCents — open Base ships free (ADR-0094). Dependencies are DOWN-ONLY (ADR-0003)
// and OPEN-ONLY (ADR-0097): the only runtime dep is `zod` (external), no @caisson workspace dep.
import pkg from "./package.json";
import { defineModule } from "./src/module-manifest.ts";

export default defineModule({
  id: "@caisson/registry-schema",
  version: pkg.version,
  kind: "base",
  tier: "oss",
  priceCents: null,
  license: pkg.license,
  dependencies: [],
  description:
    "Open registry contract: module-manifest schema + index schema + allowlist helpers + feature-tags (ADR-0074) + entitlement-expansion (ADR-0071). zod/fs-only, Apache-2.0 (ADR-0094/0097).",
});

// Registry manifest (ADR-0020/0021). Loaded by the monorepo's build-standards check; must agree with
// package.json on id/version/license/dependencies (the gate fails the build on drift). This module is
// the shared render seam for buyer-facing compliance artifacts (the SoA/trust-page lane): a
// readiness-language claim filter, allowlist-based field redaction, and citation-row rendering, so
// the ISO 27001 SoA generator (`@caisson/frameworks-pack` + `@caisson/compliance-core`) and the buyer
// trust-page generator (`@caisson/trust-page`) share one legal-gate + redaction implementation
// instead of each re-deriving the banned-claim-word regex and the field-allowlist mechanics.
//
// `sellable: false` (the platform-reads/pricebook precedent): this is internal render plumbing, never
// sold standalone — it ships only as substrate other commercial packages compose. `priceCents` is a
// PLACEHOLDER (the standards-gate still requires a positive integer for a paid/commercial manifest;
// `sellable: false` exempts it from needing a PRICE_AUTHORITY row). Dependencies are DOWN-ONLY
// (ADR-0003): this sits on the kernel's validation floor alone.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/artifact-render",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  priceCents: 2900,
  sellable: false,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  golden: "src/__golden__",
  stability: "alpha",
  description:
    "Shared render primitive for buyer-facing compliance artifacts: a readiness-language claim filter, allowlist-based field redaction, and citation-row rendering.",
});

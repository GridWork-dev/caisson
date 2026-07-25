// Registry manifest. Loaded by the monorepo's build-standards check; must agree with package.json
// on id/version/license/dependencies (the gate fails the build on drift). This module is the
// generalized risk-register: framework-agnostic likelihood x impact scoring with a computed,
// never freeform, residual, an operator-override exception chained through the audit primitive
// rather than a plain edit, and a risk-treatment-plan evidence artifact. The EU-AI-Act evidence
// collector in the compliance evidence engine now runs on an instance of this model.
//
// SKU posture: SELLABLE at $279 (the 2026-07-20 pricing round; first published 0.2.0 as
// sellable:false substrate, flipped here in the post-publish membership cut). A member of the
// Compliance and Everything bundles.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/risk-register",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  priceCents: 27900,
  sellable: true,
  license: pkg.license,
  dependencies: [
    "@caisson/audit-worm",
    "@caisson/frameworks-pack",
    "@caisson/kernel",
  ],
  golden: "src/__golden__",
  stability: "alpha",
  description:
    "A framework-agnostic risk register: likelihood x impact scoring with a computed, never freeform, residual; operator overrides recorded as a chained exception rather than an edit; crosswalk pointers into any shipped compliance framework pack; and a risk-treatment-plan evidence artifact.",
});

// Registry manifest. Loaded by the monorepo's build-standards check; must agree with package.json
// on id/version/license/dependencies (the gate fails the build on drift). This module is the
// generalized risk-register: framework-agnostic likelihood x impact scoring with a computed,
// never freeform, residual, an operator-override exception chained through the audit primitive
// rather than a plain edit, and a risk-treatment-plan evidence artifact. The EU-AI-Act evidence
// collector in the compliance evidence engine now runs on an instance of this model.
//
// `sellable: false` — not individually sold and not displayed in the catalog yet; it ships as
// substrate the compliance evidence engine composes, the same reserved-before-publish posture the
// other not-yet-catalog-listed primitives in this tree carry. `priceCents` mirrors the shared
// pre-launch placeholder anchor (4900) every other not-yet-priced commercial module carries; the
// real price locks later, alongside the module's catalog listing.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/risk-register",
  version: pkg.version,
  kind: "base",
  tier: "paid",
  priceCents: 4900,
  sellable: false,
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

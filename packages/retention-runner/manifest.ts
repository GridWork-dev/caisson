// Registry manifest (ADR-0020, ADR-0135, ADR-0152). Loaded by the monorepo's build-standards check; must agree
// with package.json on id/version/license/dependencies. `kind: "primitive"` — a shared compliance
// primitive, not a base service or an edition. Paid + LicenseRef-Caisson-Commercial (ADR-0023).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/retention-runner",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  // Positive int required by the manifest refine (ADR-0007).
  priceCents: 4900,
  license: pkg.license,
  dependencies: ["@caisson/kernel", "@caisson/jobs"],
  golden: null,
  description:
    "CCPA/GDPR right-to-erasure runner: pluggable multi-store erasure (object-storage purge -> cascade DB delete -> orphan sweep) with per-target error isolation + a reason-tagged audit row (auto_90d/ccpa_request/operator_manual), the recurring sweep scheduled via @caisson/jobs.",
});

// Registry manifest (ADR-0020/0021). Loaded by the monorepo's build-standards check; must agree with
// package.json on id/version/license/dependencies (the gate fails the build on drift). `kind:
// "primitive"` — a shared compliance primitive (WORM store + audit chain + locked-version DB), not
// a base service or an edition. Paid + LicenseRef-Caisson-Commercial under the open-core model
// (ADR-0094/0097, amends ADR-0050; base is Apache-2.0). `priceCents: 14900` is the canonical
// audit-worm primitive price ($149, ADR-0129); it must stay a positive integer (ADR-0007).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/audit-worm",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  priceCents: 14900,
  license: pkg.license,
  dependencies: [
    "@caisson/jobs",
    "@caisson/kernel",
    "@caisson/tenancy-rls",
    "@caisson/ui",
    "@caisson/ui-pro",
  ],
  golden: "src/__golden__",
  description:
    "Version-aware write-once artifact stores (S3/GCS/R2/Azure) + SHA-256 append-only audit chain with a trusted WORM anchor + append-only locked-version DB with derived-current.",
});

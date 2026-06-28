// Registry manifest (ADR-0020/0021). Loaded by @caisson/standards-gate; must agree with
// package.json on id/version/license/dependencies (the gate fails the build on drift). `kind:
// "primitive"` — a shared compliance primitive (WORM store + audit chain + locked-version DB), not
// a base service or an edition. Paid + LicenseRef-Caisson-Commercial under the uniform-commercial
// model (ADR-0050). `priceCents` is a PLACEHOLDER (4900) pending the still-open Pricing lock — it
// must be a positive integer (ADR-0007), not a final number.
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/audit-worm",
  version: "0.0.0",
  kind: "primitive",
  tier: "paid",
  priceCents: 4900,
  license: "LicenseRef-Caisson-Commercial",
  dependencies: ["@caisson/kernel", "@caisson/tenancy-rls"],
  golden: "src/__golden__",
  description:
    "Write-once (WORM) artifact store (S3 Object-Lock seam) + SHA-256 append-only audit chain with a trusted WORM anchor + append-only locked-version DB with derived-current — the compliance evidentiary primitive.",
});

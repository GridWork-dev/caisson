// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "primitive"` — a shared compliance primitive, not a base
// service or an edition. Paid + LicenseRef-Caisson-Commercial (ADR-0023).
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/field-crypto",
  version: "0.0.0",
  kind: "primitive",
  tier: "paid",
  priceCents: 4900,
  license: "LicenseRef-Caisson-Commercial",
  dependencies: ["@caisson/kernel"],
  golden: "src/__golden__",
  description:
    "Per-tenant authenticated field encryption (HKDF + AES-256-GCM + versioned envelope + Drizzle column + pluggable KMS provider).",
});

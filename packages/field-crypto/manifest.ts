// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "primitive"` — a shared compliance primitive, not a base
// service or an edition. Paid + LicenseRef-Caisson-Commercial (ADR-0023). The standalone $199
// price is locked by ADR-0129 and enforced through PRICE_AUTHORITY.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/field-crypto",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  priceCents: 19900,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  golden: "src/__golden__",
  description:
    "Per-tenant authenticated field encryption (HKDF + AES-256-GCM + versioned envelope + Drizzle column + pluggable KMS provider).",
});

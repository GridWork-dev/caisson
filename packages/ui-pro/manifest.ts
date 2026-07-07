// Registry manifest (ADR-0020). Loaded by the standards gate; it must agree with package.json on
// id, version, license, and dependencies. `kind: "primitive"` — a shared premium UI layer, not a
// base service or a bundle. Commercial: LicenseRef-Caisson-Commercial at the paid tier under the
// open-core split (ADR-0094), sitting one level above the free Apache floor it composes. The single
// runtime dependency is that floor (`@caisson/ui`); nothing else in the tree may depend back on this
// package (the leaf-law boundary, ADR-0259).
//
// `priceCents: 4900` is the pre-launch placeholder the pricing pass replaces (a positive integer is
// required to validate; the live catalog price is owned by the storefront and the price book, not
// this number).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest.ts";

export default defineModule({
  id: "@caisson/ui-pro",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  priceCents: 4900,
  license: pkg.license,
  dependencies: ["@caisson/ui"],
  description:
    "Premium data-ops and compliance UI components layered on the open @caisson/ui base: an advanced data grid, a virtualized tree, an operations matrix, a hash-chain audit timeline, a redaction-aware payload viewer, a type-to-confirm dialog, and an advanced date-range picker.",
});

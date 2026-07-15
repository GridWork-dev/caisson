// Registry manifest (ADR-0020). Loaded by the standards gate; it must agree with package.json on
// id, version, license, and dependencies. `kind: "primitive"` — a shared premium UI layer, not a
// base service or a bundle. Commercial: LicenseRef-Caisson-Commercial at the paid tier under the
// open-core split (ADR-0094), sitting one level above the free Apache floor it composes. Its runtime
// dependencies are that UI floor (`@caisson/ui`) and the open kernel base (`@caisson/kernel`, whose
// server-side redaction predicate it re-exports); nothing else in the tree may depend back on this
// package via a hard runtime dependency (the leaf-law boundary, ADR-0259).
//
// `priceCents: 12900` is trued to the live catalog ($129 standalone, inside ADR-0259's $129–199
// band); the storefront and the price book own the selling price, and this number must agree with
// them.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest.ts";

export default defineModule({
  id: "@caisson/ui-pro",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  priceCents: 12900,
  license: pkg.license,
  dependencies: ["@caisson/kernel", "@caisson/ui"],
  description:
    "Premium data-ops and compliance UI components layered on the open @caisson/ui base: an advanced data grid, a virtualized tree, an operations matrix, a hash-chain audit timeline, a redaction-aware payload viewer, a type-to-confirm dialog, an advanced date-range picker, a dependency-free charts pack, a command palette, a redaction-aware diff viewer, and a kanban board.",
});

// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest.ts";

export default defineModule({
  id: "@caisson/ui-pro",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson/kernel", "@caisson/ui"],
  description:
    "Advanced data-ops and compliance UI components layered on the open @caisson/ui base: an advanced data grid, a virtualized tree, an operations matrix, a hash-chain audit timeline, a redaction-aware payload viewer, a type-to-confirm dialog, an advanced date-range picker, a dependency-free charts pack, a command palette, a redaction-aware diff viewer, and a kanban board.",
});

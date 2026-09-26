// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/ai-meter",
  version: pkg.version,
  license: pkg.license,
  dependencies: [
    "@caisson/credits",
    "@caisson/kernel",
    "@caisson/tenancy-rls",
    "@caisson/ui",
  ],
  description:
    "Metered-inference money path: estimate→reserve→reconcile over the credit ledger + versioned price book + atomic spend window + soft/hard caps + circuit breaker (ADR-0060).",
});

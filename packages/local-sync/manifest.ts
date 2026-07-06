// Registry manifest (ADR-0020). Local sync is a commercial local-first module carved out of
// @caisson/local-ai by ADR-0258 with no cross-concern dependencies.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/local-sync",
  version: pkg.version,
  kind: "base",
  tier: "paid",
  priceCents: 19900,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  golden: "src/__golden__",
  description:
    "Local-first sync engine: changeset capture, HLC stamps, LWW reconciliation, and tombstone-aware convergence.",
});

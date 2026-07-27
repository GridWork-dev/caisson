import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/oscal-spine",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  priceCents: 24900,
  sellable: true,
  license: pkg.license,
  dependencies: ["@caisson/artifact-render", "@caisson/kernel"],
  golden: "src/__golden__",
  stability: "alpha",
  description:
    "The complete Caisson OSCAL surface: deterministic assessment-plan, assessment-results, POA&M, catalog, XML, and ISO 27001 SoA exports plus the pinned NIST 800-53 catalog and OLIR relationship mapping.",
});

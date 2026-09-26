// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/oscal-spine",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson/artifact-render", "@caisson/kernel"],
  description:
    "The complete Caisson OSCAL surface: deterministic assessment-plan, assessment-results, POA&M, catalog, XML, and ISO 27001 SoA exports plus the pinned NIST 800-53 catalog and OLIR relationship mapping.",
});

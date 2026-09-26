// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson-sh/compliance-core",
  version: pkg.version,
  license: pkg.license,
  dependencies: [
    "@caisson-sh/field-crypto",
    "@caisson-sh/frameworks-pack",
    "@caisson-sh/kernel",
    "@caisson-sh/oscal-spine",
    "@caisson-sh/risk-register",
  ],
  description:
    "The compliance evidence engine: typed collectors and a deterministic canonical evidence-pack format and generator that refuses to emit when any control's evidence is unresolved, with the complete @caisson-sh/oscal-spine surface re-exported for compatibility.",
});

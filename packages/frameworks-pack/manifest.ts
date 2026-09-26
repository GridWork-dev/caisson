// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson/frameworks-pack",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson/kernel", "@caisson/oscal-spine"],
  description:
    "Compliance framework catalogs as config-as-code: a typed canonical-control model plus own-authored SOC2-TSC, HIPAA-Security, and EU-AI-Act control packs, each control crosswalked to the external framework's requirement ids.",
});

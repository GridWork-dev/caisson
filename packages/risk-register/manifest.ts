// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson-sh/risk-register",
  version: pkg.version,
  license: pkg.license,
  dependencies: [
    "@caisson-sh/audit-worm",
    "@caisson-sh/frameworks-pack",
    "@caisson-sh/kernel",
  ],
  description:
    "A framework-agnostic risk register: likelihood x impact scoring with a computed, never freeform, residual; operator overrides recorded as a chained exception rather than an edit; crosswalk pointers into any shipped compliance framework pack; and a risk-treatment-plan evidence artifact.",
});

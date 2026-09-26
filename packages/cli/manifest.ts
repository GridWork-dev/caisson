// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "@caisson/registry-schema";

export default defineModule({
  id: "@caisson/cli",
  version: pkg.version,
  license: pkg.license,
  dependencies: [
    "@caisson/ds-manifest",
    "@caisson/jobs",
    "@caisson/kernel",
    "@caisson/migrate",
    "@caisson/registry-schema",
    "@caisson/tenancy-rls",
  ],
  description:
    "create-caisson generator: registry-catalog-gated repo composition.",
});

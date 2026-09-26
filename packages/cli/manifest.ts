// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "@caisson-sh/registry-schema";

export default defineModule({
  id: "@caisson-sh/cli",
  version: pkg.version,
  license: pkg.license,
  dependencies: [
    "@caisson-sh/ds-manifest",
    "@caisson-sh/jobs",
    "@caisson-sh/kernel",
    "@caisson-sh/migrate",
    "@caisson-sh/registry-schema",
    "@caisson-sh/tenancy-rls",
  ],
  description:
    "create-caisson generator: registry-catalog-gated repo composition.",
});

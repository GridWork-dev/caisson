// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson-sh/audit-worm",
  version: pkg.version,
  license: pkg.license,
  dependencies: [
    "@caisson-sh/jobs",
    "@caisson-sh/kernel",
    "@caisson-sh/tenancy-rls",
    "@caisson-sh/ui",
    "@caisson-sh/ui-pro",
  ],
  description:
    "Version-aware write-once artifact stores (S3/GCS/R2/Azure) + SHA-256 append-only audit chain with a trusted WORM anchor + append-only locked-version DB with derived-current.",
});

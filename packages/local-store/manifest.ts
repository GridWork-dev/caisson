// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson-sh/local-store",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson-sh/kernel", "@caisson-sh/ui"],
  description:
    "Local hybrid retrieval: sqlite-vec (vec0) + FTS5 + RRF (RRF_K=60) with an always-available FTS path and FTS-only degrade, plus the file-per-tenant isolation floor; embedding is an injected seam.",
});

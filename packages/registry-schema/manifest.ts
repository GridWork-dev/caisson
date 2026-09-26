// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "./src/module-manifest.ts";

export default defineModule({
  id: "@caisson-sh/registry-schema",
  version: pkg.version,
  license: pkg.license,
  dependencies: [],
  description:
    "Open registry contract: module-manifest schema + index schema + catalog helpers + feature-tags (ADR-0074). zod/fs-only.",
});

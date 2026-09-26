// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson-sh/local-sync",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson-sh/kernel"],
  description:
    "Local-first sync engine: changeset capture, HLC stamps, LWW reconciliation, and tombstone-aware convergence.",
});

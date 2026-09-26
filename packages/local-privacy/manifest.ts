// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson/local-privacy",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  description:
    "Local-first privacy gate: strict zero-egress policy parsing plus EgressGuard over the kernel fetchWithTimeout chokepoint.",
});

// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson-sh/tool-exec",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson-sh/kernel"],
  description:
    "Governed tool-call / sandboxed-exec primitive: default-deny command allowlist + Zod-strict argument schemas + execFile arg-arrays only (no shell) + structured argument provenance.",
});

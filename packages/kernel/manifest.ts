// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest.ts";

export default defineModule({
  id: "@caisson-sh/kernel",
  version: pkg.version,
  license: pkg.license,
  dependencies: [],
  description:
    "Governance kernel: typed config loader, CaissonError hierarchy (ADR-0019), security primitives (timingSafeEqual/randomUUID), and the standards gate (ADR-0016).",
});

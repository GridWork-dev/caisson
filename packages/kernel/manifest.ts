// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest.ts";

export default defineModule({
  id: "@caisson/kernel",
  version: pkg.version,
  license: pkg.license,
  dependencies: [],
  description:
    "Governance kernel: typed config loader, CaissonError hierarchy (ADR-0019), security primitives (timingSafeEqual/randomUUID), and the standards gate (ADR-0016).",
});

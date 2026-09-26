// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest.ts";

export default defineModule({
  id: "@caisson/ui",
  version: pkg.version,
  license: pkg.license,
  dependencies: [],
  description:
    "Typed OKLCH token floor (ADR-0042 design foundation: palette + type scale) — OKLCH token objects generate tokens.css via a small gen-script.",
});

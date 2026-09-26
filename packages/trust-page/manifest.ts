// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson-sh/trust-page",
  version: pkg.version,
  license: pkg.license,
  dependencies: [
    "@caisson-sh/artifact-render",
    "@caisson-sh/compliance-core",
    "@caisson-sh/kernel",
  ],
  description:
    "Trust-page generator: a self-contained static HTML + JSON page, built from an evidence pack + its crosswalk rollup through allowlist-based redaction, that you host anywhere to show prospects your compliance posture.",
});

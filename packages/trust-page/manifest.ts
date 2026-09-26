// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson/trust-page",
  version: pkg.version,
  license: pkg.license,
  dependencies: [
    "@caisson/artifact-render",
    "@caisson/compliance-core",
    "@caisson/kernel",
  ],
  description:
    "Buyer trust-page generator: a self-contained static HTML + JSON page, built from an evidence pack + its crosswalk rollup through allowlist-based redaction, that a buyer hosts anywhere to show prospects their compliance posture.",
});

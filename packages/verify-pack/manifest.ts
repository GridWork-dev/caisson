// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson-sh/verify-pack",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson-sh/kernel"],
  description:
    "Out-of-band verifier for Caisson audit evidence packs: validates the signed complete-file manifest, pack seal, receipt chain, and per-row anchor signatures without trusting executable code from the pack.",
});

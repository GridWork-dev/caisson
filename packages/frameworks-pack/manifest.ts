// Registry manifest (ADR-0020/0021). Loaded by the monorepo's build-standards check; must agree with
// package.json on id/version/license/dependencies (the gate fails the build on drift). This module is
// the framework-catalog carve out of the Compliance edition (ADR-0246/0257): the typed canonical-control
// model plus the own-authored SOC2-TSC, HIPAA-Security, and EU-AI-Act control packs. Clean-room
// authorship holds — crosswalk references point to external requirement ids, never copied control text.
//
// `priceCents: 24900` is the locked standalone price for this carve ($249, ADR-0252); it must stay a
// positive integer (ADR-0007). Dependencies are DOWN-ONLY (ADR-0003): the pack sits on the kernel's
// validation floor and re-exports the sideways module-tier `@caisson/oscal-spine` dependency — the
// Compliance edition composes it, never the reverse.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/frameworks-pack",
  version: pkg.version,
  kind: "base",
  tier: "paid",
  priceCents: 24900,
  license: pkg.license,
  dependencies: ["@caisson/kernel", "@caisson/oscal-spine"],
  golden: "src/__golden__",
  stability: "alpha",
  description:
    "Compliance framework catalogs as config-as-code: a typed canonical-control model plus own-authored SOC2-TSC, HIPAA-Security, and EU-AI-Act control packs, each control crosswalked to the external framework's requirement ids.",
});

// Registry manifest (ADR-0020/0021). Loaded by the monorepo's build-standards check; must agree with
// package.json on id/version/license/dependencies (the gate fails the build on drift). This module is
// the evidence-engine carve out of the Compliance edition (ADR-0246/0257): collectors, the canonical
// evidence-pack format plus deterministic generator (flag-never-guess — generation hard-blocks when
// any control's evidence is unresolved), and the OSCAL export seam.
//
// `priceCents: 29900` is the locked standalone price for this carve ($299, ADR-0252); it must stay a
// positive integer (ADR-0007). Dependencies are DOWN-ONLY (ADR-0003): the engine consumes the kernel
// integrity floor, the framework catalogs it runs against, the field-crypto primitive its policy
// collector inspects, and the generalized risk model its EU-AI-Act risk-register collector now runs
// on — the Compliance edition composes this engine, never the reverse.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/compliance-core",
  version: pkg.version,
  kind: "base",
  tier: "paid",
  priceCents: 29900,
  license: pkg.license,
  dependencies: [
    "@caisson/field-crypto",
    "@caisson/frameworks-pack",
    "@caisson/kernel",
    "@caisson/risk-register",
  ],
  golden: "src/__golden__",
  stability: "alpha",
  description:
    "The compliance evidence engine: typed collectors, a deterministic canonical evidence-pack format and generator that refuses to emit when any control's evidence is unresolved, and OSCAL exports (assessment plan, assessment results, plan of action and milestones, XML round-trip).",
});

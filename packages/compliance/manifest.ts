// Registry manifest (ADR-0020/0021). Loaded by @caisson/standards-gate; must agree with
// package.json on id/version/license/dependencies (the gate fails the build on drift). `kind:
// "edition"` — this is the Compliance EDITION (the hero, ADR-0040), a composition of base packages,
// never a fork (ADR-0003); it names its own edition membership in `editions`. Paid +
// LicenseRef-Caisson-Commercial under the uniform-commercial model (ADR-0050).
//
// `priceCents` is a PLACEHOLDER pending the still-open Pricing lock (ADR-0012 anchors only) — it must
// be a positive integer (ADR-0007), not a final number. Evidence generation is FREE in v1 (no
// @caisson/credits dependency, ADR-0007 unit deferred to P6): the edition composes the WORM/crypto
// primitives directly. Dependencies are DOWN-ONLY (ADR-0003): the edition imports base/primitive
// packages, never the reverse.
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/compliance",
  version: "0.0.0",
  kind: "edition",
  editions: ["compliance"],
  tier: "paid",
  priceCents: 99900,
  license: "LicenseRef-Caisson-Commercial",
  dependencies: [
    "@caisson/audit-worm",
    "@caisson/field-crypto",
    "@caisson/tenancy-rls",
    "@caisson/kernel",
  ],
  // Frozen member pin map (ADR-0077): edition self + every bundled dependency, exact-version.
  members: {
    "@caisson/compliance": "0.0.0",
    "@caisson/audit-worm": "0.0.0",
    "@caisson/field-crypto": "0.0.0",
    "@caisson/tenancy-rls": "0.0.0",
    "@caisson/kernel": "0.0.0",
  },
  golden: "src/__golden__",
  description:
    "Compliance edition (the hero): seeds a tenant, writes encrypted SEC/HIPAA fields under a tenant-scoped crypto boundary, locks an append-only artifact into WORM with a SHA-256 audit-chain anchor, and emits a deterministic, signed control→evidence pack — own-authored SOC2-TSC + HIPAA control packs, flag-never-guess generation.",
});

// Registry manifest (ADR-0020/0021/0257). Loaded by the monorepo's build-standards check; must agree
// with package.json on id/version/license/dependencies (the gate fails the build on drift). `kind:
// "bundle"` — the Compliance persona BUNDLE (the hero, ADR-0040), the six-bundle catalog's one bundle
// that KEEPS its legacy id (`compliance` is the identity alias, ADR-0257 §1); the historical
// `kind:"edition"` ledger entries stay valid forever. Unlike the four meta-only persona bundles this
// package carries real composition code, so `dependencies` stays populated (down-only, ADR-0003).
// Paid + LicenseRef-Caisson-Commercial under the open-core model (ADR-0094/0097, amends ADR-0050).
//
// `priceCents: 164900` is the locked Compliance bundle price ($1,649, the 2026-07-25 OSCAL-spine
// round — supersedes the $1,449 compliance-gap price as the new member joins; 71.1% of the
// enlarged $2,319 member subtotal); it must stay a positive integer
// (ADR-0007). Evidence generation is
// FREE in v1 (no @caisson/credits dependency): the bundle composes the WORM/crypto primitives
// directly.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/compliance",
  version: pkg.version,
  kind: "bundle",
  tier: "paid",
  priceCents: 164900,
  license: pkg.license,
  // Must mirror package.json's @caisson/* deps exactly (the gate fails on drift). @caisson/migrate is
  // the base migration assembler/runner the edition COMPOSES at build/test time (ADR-0090).
  dependencies: [
    "@caisson/audit-worm",
    "@caisson/compliance-core",
    "@caisson/field-crypto",
    "@caisson/frameworks-pack",
    "@caisson/kernel",
    "@caisson/migrate",
    "@caisson/signing-primitive",
    "@caisson/tenancy-rls",
  ],
  // Frozen member pin map (ADR-0077): edition self + every BUYER-FACING bundled module, exact-version.
  // @caisson/migrate is intentionally NOT a member: it is compose-time tooling (resolved transitively
  // via npm when the edition installs), not a buyer top-level module — folding it would force migrate
  // to be published before the edition could generate (members pins fail closed if absent from the
  // index, meter.ts resolveEditionMembers). It stays a dependency, not a frozen member pin.
  // Each pin is the member's CURRENT published version in registry/index.json. No code rewrites these
  // pins (there is no publish-time rewrite step) — they are hand-maintained: the members-fold republish
  // snapshots this map into registry/ledger.jsonl → registry/index.json (byte-identical CI rebuild),
  // and the full-tree-index guard test asserts every pin resolves to a real published ledger version
  // (never the "0.0.0" dev sentinel).
  members: {
    "@caisson/compliance": "0.5.3",
    // The three compliance carve SKUs folded into the Compliance bundle
    // (members-fold republish, third wave).
    "@caisson/compliance-core": "0.3.1",
    "@caisson/frameworks-pack": "0.4.0",
    // oscal-spine enters at its workspace version in the same release cut; the pre-publish
    // coverage gate explicitly permits same-cut exact-version pins.
    "@caisson/oscal-spine": "0.1.0",
    "@caisson/signing-primitive": "0.3.0",
    "@caisson/audit-worm": "2.1.0",
    "@caisson/field-crypto": "0.3.2",
    "@caisson/tenancy-rls": "0.5.2",
    "@caisson/kernel": "0.5.0",
    // The 2026-07-20 compliance-gap join: the three reserved SKUs enter at their first
    // published version (the two-consume arming — publish first, membership after).
    "@caisson/access-review": "0.2.0",
    "@caisson/risk-register": "0.2.0",
    "@caisson/trust-page": "0.2.0",
  },
  golden: "src/__golden__",
  description:
    "Compliance edition (the hero): seeds a tenant, writes encrypted SEC/HIPAA fields under a tenant-scoped crypto boundary, locks an append-only artifact into WORM with a SHA-256 audit-chain anchor, and emits a deterministic, signed control→evidence pack — own-authored SOC2-TSC + HIPAA control packs, flag-never-guess generation.",
});

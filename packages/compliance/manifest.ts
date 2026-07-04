// Registry manifest (ADR-0020/0021). Loaded by the monorepo's build-standards check; must agree with
// package.json on id/version/license/dependencies (the gate fails the build on drift). `kind:
// "edition"` — this is the Compliance EDITION (the hero, ADR-0040), a composition of base packages,
// never a fork (ADR-0003); it names its own edition membership in `editions`. Paid +
// LicenseRef-Caisson-Commercial under the open-core model (ADR-0094/0097, amends ADR-0050): base is
// Apache-2.0; editions/primitives/cli/registry stay commercial.
//
// `priceCents` must be a positive integer (ADR-0007). Evidence generation is FREE in v1 (no
// @caisson/credits dependency): the edition composes the WORM/crypto primitives directly.
// Dependencies are DOWN-ONLY (ADR-0003): the edition imports base/primitive packages, never the
// reverse.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/compliance",
  version: pkg.version,
  kind: "edition",
  editions: ["compliance"],
  tier: "paid",
  priceCents: 99900,
  license: pkg.license,
  // Must mirror package.json's @caisson/* deps exactly (the gate fails on drift). @caisson/migrate is
  // the base migration assembler/runner the edition COMPOSES at build/test time (ADR-0090).
  // @caisson/alerting + @caisson/retention-runner are primitives folded into the bundle (ADR-0178)
  // and composed at runtime via `createComplianceEdition` (src/edition.ts, ADR-0199 shape).
  dependencies: [
    "@caisson/alerting",
    "@caisson/audit-worm",
    "@caisson/field-crypto",
    "@caisson/migrate",
    "@caisson/retention-runner",
    "@caisson/tenancy-rls",
    "@caisson/kernel",
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
    "@caisson/compliance": "0.2.1",
    "@caisson/audit-worm": "0.2.1",
    "@caisson/field-crypto": "0.2.1",
    "@caisson/tenancy-rls": "0.3.0",
    "@caisson/kernel": "0.3.0",
    // Operational-compliance primitives folded into the Compliance bundle (ADR-0178).
    "@caisson/alerting": "0.1.2",
    "@caisson/retention-runner": "0.1.2",
  },
  golden: "src/__golden__",
  description:
    "Compliance edition (the hero): seeds a tenant, writes encrypted SEC/HIPAA fields under a tenant-scoped crypto boundary, locks an append-only artifact into WORM with a SHA-256 audit-chain anchor, and emits a deterministic, signed control→evidence pack — own-authored SOC2-TSC + HIPAA control packs, flag-never-guess generation.",
});

// Registry manifest (ADR-0020/0021/0257). Loaded by @caisson/standards-gate; must agree with
// package.json on id/version/license/dependencies. `kind: "bundle"` — the net-new Provenance bundle
// (ADR-0257), a strict member-subset of Compliance sold on its own. A bundle is a pure packaging
// object: it carries NO composition code of its own, only the frozen `members` pin map that expands to
// its member modules (ADR-0077/0071) — so `dependencies` stays empty and the members map is the truth.
// `priceCents: 39900` is the locked bundle price ($399, ADR-0260); positive integer required (ADR-0007).
// Pins mirror the members' current published versions where they exist; the pre-publish signing carve
// pins its package version and the members-fold republish (a later wave) resolves it to a real release.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/provenance",
  version: pkg.version,
  kind: "bundle",
  tier: "paid",
  priceCents: 39900,
  license: pkg.license,
  // Frozen member pin map (ADR-0077/0257): the bundle self + every member module, exact-version.
  members: {
    "@caisson/provenance": "0.2.1",
    "@caisson/signing-primitive": "0.2.0",
    "@caisson/audit-worm": "0.3.0",
    "@caisson/field-crypto": "0.3.0",
  },
  description:
    "Provenance bundle: per-tenant evidence signing (@caisson/signing-primitive detached Ed25519 + RFC-3161 countersign), an append-only SHA-256 WORM audit chain (@caisson/audit-worm), and at-rest field encryption (@caisson/field-crypto) — the provenance cut of Compliance, sold standalone.",
});

// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "edition"` — the Local-first AI edition is a COMPOSITION,
// not a fork (ADR-0003): it depends DOWN-ONLY on base/primitive packages and never up on a peer
// edition (ADR-0022). Commercial under the open-core model (ADR-0094/0097, amends ADR-0050; base is
// Apache-2.0, editions stay commercial; the former AGPL Local-first flank stays retired — the package
// license is LicenseRef-Caisson-Commercial like every edition).
// `priceCents` is the CANONICAL Local-first edition price ($629 = 62900) — locked by ADR-0258
// after the local-sync/local-inference/local-privacy 3-way carve.
// The carved sync golden fixtures now live in @caisson/local-sync. This meta package has no direct
// golden-able artifact of its own.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/local-ai",
  version: pkg.version,
  kind: "edition",
  editions: ["local-ai"],
  tier: "paid",
  priceCents: 62900,
  sellable: false,
  license: pkg.license,
  dependencies: [
    "@caisson/kernel",
    "@caisson/local-store",
    "@caisson/license-verify",
    "@caisson/field-crypto",
    "@caisson/local-privacy",
    "@caisson/local-inference",
    "@caisson/local-sync",
  ],
  // Frozen member pin map (ADR-0077): edition self + every bundled dependency, exact-version.
  members: {
    "@caisson/local-ai": "0.2.5",
    "@caisson/kernel": "0.4.2",
    "@caisson/local-store": "0.2.4",
    "@caisson/license-verify": "0.3.0",
    "@caisson/field-crypto": "0.3.0",
    "@caisson/local-privacy": "0.1.1",
    "@caisson/local-inference": "0.1.1",
    "@caisson/local-sync": "0.1.1",
  },
  golden: null,
  description:
    "Local-first AI edition (composition): @caisson/local-store hybrid retrieval (sqlite-vec + FTS5 RRF) + @caisson/license-verify offline Ed25519 + @caisson/field-crypto at-rest + @caisson/kernel, plus a built two-way sync engine, an InferenceBackend port, a zero-egress privacy gate, and file-per-tenant isolation. Offline, no-lock-in.",
});

// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "edition"` — the Local-first AI edition is a COMPOSITION,
// not a fork (ADR-0003): it depends DOWN-ONLY on base/primitive packages and never up on a peer
// edition (ADR-0022). Commercial under the open-core model (ADR-0094/0097, amends ADR-0050; base is
// Apache-2.0, editions stay commercial; the former AGPL Local-first flank stays retired — the package
// license is LicenseRef-Caisson-Commercial like every edition).
// `priceCents` is a pre-launch PLACEHOLDER anchored to the ADR-0012 Local-first AI one-time low
// ($349 = 34900) — final pricing is the still-open "Pricing numbers" board fork, out of scope here.
// `golden` points at the sync-reconcile conflict fixtures (src/sync/__golden__ — the LWW + tombstone
// resolves asserted via `matchGolden`); create-caisson (P5) consumes this relative path. The relative
// import keeps `@caisson/registry` out of the runtime deps.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/local-ai",
  version: pkg.version,
  kind: "edition",
  editions: ["local-ai"],
  tier: "paid",
  priceCents: 34900,
  license: pkg.license,
  dependencies: [
    "@caisson/kernel",
    "@caisson/local-store",
    "@caisson/license-verify",
    "@caisson/field-crypto",
  ],
  // Frozen member pin map (ADR-0077): edition self + every bundled dependency, exact-version.
  members: {
    "@caisson/local-ai": "0.2.0",
    "@caisson/kernel": "0.2.0",
    "@caisson/local-store": "0.2.0",
    "@caisson/license-verify": "0.2.0",
    "@caisson/field-crypto": "0.2.0",
  },
  golden: "src/sync/__golden__",
  description:
    "Local-first AI edition (composition): @caisson/local-store hybrid retrieval (sqlite-vec + FTS5 RRF) + @caisson/license-verify offline Ed25519 + @caisson/field-crypto at-rest + @caisson/kernel, plus a built two-way sync engine, an InferenceBackend port, a zero-egress privacy gate, and file-per-tenant isolation. Offline, no-lock-in.",
});

// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "primitive"` — a governed tool-call gate, not a base
// service or an edition (a primitive does not self-declare edition membership; the Agentic-Dev
// edition adds it to its `members` pin map at integration, exactly like field-crypto). Paid +
// LicenseRef-Caisson-Commercial (ADR-0153).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/tool-exec",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  // $99 standalone, locked by ADR-0260 §3 (sum-of-parts, comps-anchored). Off the $49 pre-launch
  // placeholder anchor, so it now carries a PRICE_AUTHORITY row (tooling/standards-gate). Positive
  // integer required by the manifest refine (ADR-0007).
  priceCents: 9900,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  golden: null,
  description:
    "Governed tool-call / sandboxed-exec primitive: default-deny command allowlist + Zod-strict argument schemas + execFile arg-arrays only (no shell) + structured argument provenance.",
});

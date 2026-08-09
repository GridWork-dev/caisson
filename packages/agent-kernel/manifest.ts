// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "base"` (ADR-0065) — the engine-neutral agent kernel both
// base (cli/mcp-server) and the Agentic-Dev bundle consume DOWN-ONLY (never imports a bundle,
// ADR-0022). Paid + LicenseRef-Caisson-Commercial (ADR-0023/0050; AGPL flank closed).
// Standalone pricing is locked at $199 by ADR-0129 and enforced through PRICE_AUTHORITY. Relative
// import keeps `@caisson/registry` out of the runtime dep set: the sole declared dependency is
// `@caisson/kernel`.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/agent-kernel",
  version: pkg.version,
  kind: "base",
  tier: "paid",
  priceCents: 19900,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  golden: "src/__golden__",
  description:
    "Engine-neutral agent kernel: agent/skill/rule Zod schema + lifecycle act FSM + hooks dispatcher; consumed base→base (cli/mcp-server) and bundle→base (agentic-dev).",
});

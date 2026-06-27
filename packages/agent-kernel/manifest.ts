// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "base"` (ADR-0065) — the engine-neutral agent kernel both
// base (cli/mcp-server) and the agent-dev edition consume DOWN-ONLY (never imports an edition,
// ADR-0022 Gate-3). Paid + LicenseRef-Caisson-Commercial (ADR-0023/0050; AGPL flank closed).
// `priceCents` is the established pre-launch placeholder anchor (4900) — final pricing is the open
// "Pricing numbers" board fork, out of scope here. Relative import keeps `@caisson/registry` out of
// the runtime dep set: the sole declared dependency is `@caisson/kernel`.
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/agent-kernel",
  version: "0.0.0",
  kind: "base",
  tier: "paid",
  priceCents: 4900,
  license: "LicenseRef-Caisson-Commercial",
  dependencies: ["@caisson/kernel"],
  golden: "src/__golden__",
  description:
    "Engine-neutral agent kernel: agent/skill/rule Zod schema + lifecycle act FSM + hooks dispatcher; consumed base→base (cli/mcp-server) and edition→base (agent-dev).",
});

// Registry manifest (ADR-0020/0021/0257). Loaded by @caisson/standards-gate; must agree with
// package.json on id/version/license/dependencies. `kind: "bundle"` — the Agentic-Dev persona bundle
// (ADR-0257), the new-vocabulary successor to the legacy `agent-dev` edition (which stays valid
// forever; `agent-dev` aliases to `agentic-dev`). A bundle carries NO composition code — only the
// frozen `members` pin map (ADR-0077/0071) — so `dependencies` stays empty. Members mirror the
// agent-dev edition (tool-exec is already a member). `priceCents: 32900` is the locked bundle price
// ($329, ADR-0260 §3, below-sum); positive integer (ADR-0007). UNCHANGED by the S5 addition below:
// adding a member only grows the priced-member sum the below-sum invariant checks against, so $329
// stays comfortably below it.
//
// PUBLISH (S5, ADR-0361/0362): `@caisson/agent-trajectory` joins as a member — the governed
// agent-runtime loop's trajectory/run-state substrate, exposed this slice via `caisson run start`
// (CLI) and the `run_start`/`run_status` MCP tools, both gated on agent-trajectory's own dedicated
// entitlement (ADR-0362, never this bundle's fold slug). Pinned at "0.2.0", its currently-ledgered
// version (`registry/index.json`) — a member pin only needs to name a REAL published version, not
// latest (append-only ledger, precedented by every other member pin here).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/agentic-dev",
  version: pkg.version,
  kind: "bundle",
  tier: "paid",
  priceCents: 32900,
  license: pkg.license,
  members: {
    "@caisson/agentic-dev": "0.2.1",
    "@caisson/agent-kernel": "0.6.0",
    "@caisson/agent-runner": "0.2.0",
    "@caisson/agent-trajectory": "0.2.0",
    "@caisson/ai-config": "0.3.2",
    "@caisson/kernel": "0.5.0",
    "@caisson/local-store": "1.0.1",
    "@caisson/tool-exec": "0.1.7",
  },
  description:
    "Agentic-Dev bundle: composes @caisson/agent-kernel (governed engine-neutral agent lifecycle) + @caisson/agent-runner (sandboxed execution) + @caisson/agent-trajectory (governed tool-loop trajectory + run-state) + @caisson/tool-exec (governed tool-calls) + @caisson/local-store (hybrid memory) + @caisson/ai-config (embedder lane) into one governed agent-build stack.",
});

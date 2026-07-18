// Registry manifest (ADR-0020/0021/0257). Loaded by @caisson/standards-gate; must agree with
// package.json on id/version/license/dependencies. `kind: "bundle"` — the Agentic-Dev persona bundle
// (ADR-0257), the new-vocabulary successor to the legacy `agent-dev` edition (which stays valid
// forever; `agent-dev` aliases to `agentic-dev`). A bundle carries NO composition code — only the
// frozen `members` pin map (ADR-0077/0071) — so `dependencies` stays empty. Members mirror the
// agent-dev edition (tool-exec is already a member). `priceCents: 32900` is the locked bundle price
// ($329, ADR-0260 §3, below-sum); positive integer (ADR-0007).
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
    // agent-trajectory joins at the version CARRYING the encrypted-parked-state wrap (0.3.0,
    // ledgered by the 2026-07-18 consume) — a member pin must name the wrap-bearing sellable
    // version, never merely a real published one (the pre-encRef 0.2.0 must never compose).
    "@caisson/agent-trajectory": "0.3.0",
    "@caisson/ai-config": "0.3.2",
    "@caisson/kernel": "0.5.0",
    "@caisson/local-store": "1.0.1",
    "@caisson/tool-exec": "0.1.7",
  },
  description:
    "Agentic-Dev bundle: composes @caisson/agent-kernel (governed engine-neutral agent lifecycle) + @caisson/agent-runner (sandboxed execution) + @caisson/tool-exec (governed tool-calls) + @caisson/local-store (hybrid memory) + @caisson/ai-config (embedder lane) into one governed agent-build stack.",
});

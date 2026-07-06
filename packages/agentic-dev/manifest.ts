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
    "@caisson/agentic-dev": "0.1.0",
    "@caisson/agent-kernel": "0.3.0",
    "@caisson/agent-runner": "0.1.3",
    "@caisson/ai-config": "0.2.3",
    "@caisson/kernel": "0.4.1",
    "@caisson/local-store": "0.2.3",
    "@caisson/tool-exec": "0.1.4",
  },
  description:
    "Agentic-Dev bundle: composes @caisson/agent-kernel (governed engine-neutral agent lifecycle) + @caisson/agent-runner (sandboxed execution) + @caisson/tool-exec (governed tool-calls) + @caisson/local-store (hybrid memory) + @caisson/ai-config (embedder lane) into one governed agent-build stack.",
});

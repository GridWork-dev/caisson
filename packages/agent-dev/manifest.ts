// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "edition"` (ADR-0066) — the Agentic-Dev edition is a
// COMPOSITION, never a primitive: it consumes the shipped base seams DOWN-ONLY (ADR-0003/0022 Gate-3)
// — the governed engine-neutral agent kernel (`@caisson/agent-kernel`), local hybrid memory
// (`@caisson/local-store`), the embedder-lane seam (`@caisson/ai-config`), and the kernel compliance
// substrate (`@caisson/kernel`) the audited lifecycle records into. It NEVER imports another edition.
// `editions: ["agent-dev"]` names its own membership (required for `kind: "edition"`). Paid +
// LicenseRef-Caisson-Commercial (ADR-0050; the AGPL flank is retired). `priceCents` is the established
// pre-launch placeholder anchor (4900) — final pricing is the open "Pricing numbers" board fork, out
// of scope here. The relative import keeps `@caisson/registry` out of the runtime dep set.
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/agent-dev",
  version: "0.0.0",
  kind: "edition",
  editions: ["agent-dev"],
  tier: "paid",
  priceCents: 4900,
  license: "LicenseRef-Caisson-Commercial",
  dependencies: [
    "@caisson/agent-kernel",
    "@caisson/ai-config",
    "@caisson/kernel",
    "@caisson/local-store",
  ],
  // Frozen member pin map (ADR-0077): edition self + every bundled dependency, exact-version.
  members: {
    "@caisson/agent-dev": "0.0.0",
    "@caisson/agent-kernel": "0.0.0",
    "@caisson/ai-config": "0.0.0",
    "@caisson/kernel": "0.0.0",
    "@caisson/local-store": "0.0.0",
  },
  golden: "src/__golden__",
  description:
    "Agentic-Dev edition: composes the governed engine-neutral agent kernel + local hybrid memory + a thin multi-harness emitter (.claude/ · Codex AGENTS.md · Cursor) from one typed Caisson schema; Claude Code is one emit target among several, never the substrate.",
});

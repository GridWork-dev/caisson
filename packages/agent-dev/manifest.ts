// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "edition"` (ADR-0066) — the Agentic-Dev edition is a
// COMPOSITION, never a primitive: it consumes the shipped base seams DOWN-ONLY (ADR-0003/0022 Gate-3)
// — the governed engine-neutral agent kernel (`@caisson/agent-kernel`), local hybrid memory
// (`@caisson/local-store`), the embedder-lane seam (`@caisson/ai-config`), the governed sandboxed
// tool-exec gate (`@caisson/tool-exec`, ADR-0178), and the kernel compliance substrate
// (`@caisson/kernel`) the audited lifecycle records into. It NEVER imports another edition.
// `editions: ["agent-dev"]` names its own membership (required for `kind: "edition"`). Paid +
// LicenseRef-Caisson-Commercial (ADR-0050; the AGPL flank is retired). `priceCents` is the established
// pre-launch placeholder anchor (4900) — final pricing is the open "Pricing numbers" board fork, out
// of scope here. The relative import keeps `@caisson/registry` out of the runtime dep set.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/agent-dev",
  version: pkg.version,
  kind: "edition",
  editions: ["agent-dev"],
  tier: "paid",
  priceCents: 4900,
  license: pkg.license,
  dependencies: [
    "@caisson/agent-kernel",
    "@caisson/agent-runner",
    "@caisson/ai-config",
    "@caisson/kernel",
    "@caisson/local-store",
    "@caisson/tool-exec",
  ],
  // Frozen member pin map (ADR-0077): edition self + every bundled dependency, exact-version. Each pin
  // is the member's CURRENT published version in registry/index.json. No code rewrites these pins
  // (there is no publish-time rewrite step) — they are hand-maintained: the members-fold republish
  // snapshots this map into registry/ledger.jsonl → registry/index.json (byte-identical CI rebuild),
  // and the full-tree-index guard test asserts every pin resolves to a real published ledger version
  // (never the "0.0.0" dev sentinel).
  members: {
    "@caisson/agent-dev": "0.2.0",
    "@caisson/agent-kernel": "0.2.0",
    // Slice-2 harvest primitive folded into the Agentic-Dev bundle (ADR-0186 F1/F5, edition-only
    // SKU) — same fold as tool-exec below, pinned to its published ledger version.
    "@caisson/agent-runner": "0.1.0",
    "@caisson/ai-config": "0.2.0",
    "@caisson/kernel": "0.2.0",
    "@caisson/local-store": "0.2.0",
    // Stage-2 harvest primitive folded into the Agentic-Dev bundle (ADR-0178/0199 — wired live in
    // src/index.ts's createAgentDevEdition).
    "@caisson/tool-exec": "0.1.1",
  },
  golden: "src/__golden__",
  description:
    "Agentic-Dev edition: composes the governed engine-neutral agent kernel + local hybrid memory + a thin multi-harness emitter (.claude/ · Codex AGENTS.md · Cursor) from one typed Caisson schema; Claude Code is one emit target among several, never the substrate.",
});

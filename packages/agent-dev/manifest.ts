// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "edition"` (ADR-0066) — the Agentic-Dev edition is a
// COMPOSITION, never a primitive: it consumes the shipped base seams DOWN-ONLY (ADR-0003/0022)
// — the governed engine-neutral agent kernel (`@caisson/agent-kernel`), local hybrid memory
// (`@caisson/local-store`), the embedder-lane seam (`@caisson/ai-config`), the governed sandboxed
// tool-exec gate (`@caisson/tool-exec`, ADR-0178), and the kernel compliance substrate
// (`@caisson/kernel`) the audited lifecycle records into. It NEVER imports another edition.
// `editions: ["agent-dev"]` names its own membership (required for `kind: "edition"`). Paid +
// LicenseRef-Caisson-Commercial (ADR-0050; the AGPL flank is retired). `priceCents: 32900` is the
// locked Agentic-Dev bundle price ($329, ADR-0258) — this retired legacy id aliases to `agentic-dev`
// forever (ADR-0257 single alias point) and carries its alias target's price, the same truing
// convention `local-ai` uses. Behavior unchanged: the id keeps resolving via the alias map.
// The relative import keeps `@caisson/registry` out of the runtime dep set.
// ADR-0264 (2026-07-06): the source IR gained an optional rule/skill `activation`/`paths` pair
// (never-silent-degrade fidelity warnings on every target), three new emit targets (Devin Desktop +
// legacy Windsurf, GitHub Copilot, Cline), and the emitted `AGENTS.md` is reframed as the universal
// multi-tool BASE layer — Codex, Cursor, Devin, Zed, Gemini CLI, and the Copilot coding agent all
// read it natively (the "Codex harness" framing this description used before is superseded).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/agent-dev",
  version: pkg.version,
  kind: "edition",
  editions: ["agent-dev"],
  tier: "paid",
  priceCents: 32900,
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
    "@caisson/agent-dev": "0.4.0",
    "@caisson/agent-kernel": "0.4.0",
    // A separately-versioned primitive folded into the Agentic-Dev bundle (ADR-0186, edition-only
    // SKU) — same fold as tool-exec below, pinned to its published ledger version.
    "@caisson/agent-runner": "0.1.4",
    "@caisson/ai-config": "0.3.0",
    "@caisson/kernel": "0.4.2",
    "@caisson/local-store": "0.2.4",
    // A separately-versioned primitive folded into the Agentic-Dev bundle (ADR-0178/0199 — wired
    // live in src/index.ts's createAgentDevEdition).
    "@caisson/tool-exec": "0.1.5",
  },
  golden: "src/__golden__",
  description:
    "Agentic-Dev edition: composes the governed engine-neutral agent kernel + local hybrid memory + a thin multi-harness emitter (.claude/ · the universal AGENTS.md base layer · Cursor · Devin/Windsurf · GitHub Copilot · Cline) from one typed Caisson schema; Claude Code is one emit target among several, never the substrate.",
});

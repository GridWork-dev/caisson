// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson/agent-dev",
  version: pkg.version,
  license: pkg.license,
  dependencies: [
    "@caisson/agent-kernel",
    "@caisson/agent-runner",
    "@caisson/ai-config",
    "@caisson/kernel",
    "@caisson/local-store",
    "@caisson/tool-exec",
  ],
  description:
    "Agentic-Dev kit: composes the governed engine-neutral agent kernel + local hybrid memory + a thin multi-harness emitter (.claude/ · the universal AGENTS.md base layer · Cursor · Devin/Windsurf · GitHub Copilot · Cline) from one typed Caisson schema; Claude Code is one emit target among several, never the substrate.",
});

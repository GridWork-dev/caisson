// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson-sh/agent-dev",
  version: pkg.version,
  license: pkg.license,
  dependencies: [
    "@caisson-sh/agent-kernel",
    "@caisson-sh/agent-runner",
    "@caisson-sh/ai-config",
    "@caisson-sh/kernel",
    "@caisson-sh/local-store",
    "@caisson-sh/tool-exec",
  ],
  description:
    "Agentic-Dev kit: composes the governed engine-neutral agent kernel + local hybrid memory + a thin multi-harness emitter (.claude/ · the universal AGENTS.md base layer · Cursor · Devin/Windsurf · GitHub Copilot · Cline) from one typed Caisson schema; Claude Code is one emit target among several, never the substrate.",
});

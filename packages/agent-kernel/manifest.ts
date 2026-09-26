// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/agent-kernel",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  description:
    "Engine-neutral agent kernel: agent/skill/rule Zod schema + lifecycle act FSM + hooks dispatcher; consumed base→base (cli/mcp-server).",
});

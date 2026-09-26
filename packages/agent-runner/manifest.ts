// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson-sh/agent-runner",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson-sh/agent-trajectory", "@caisson-sh/kernel"],
  description:
    "Sandboxed governed agent runner: spawn a headless agent CLI (provider-agnostic {binary, baseUrlEnv, authEnv, model}) in an isolated worktree with a from-scratch scrubbed env — never spreads process.env — streaming an auditable .jsonl transcript parsed into a structured run report.",
});

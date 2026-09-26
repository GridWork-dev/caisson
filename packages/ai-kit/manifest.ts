// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson-sh/ai-kit",
  version: pkg.version,
  license: pkg.license,
  dependencies: [
    "@caisson-sh/agent-trajectory",
    "@caisson-sh/ai-config",
    "@caisson-sh/ai-meter",
    "@caisson-sh/credits",
    "@caisson-sh/field-crypto",
    "@caisson-sh/guardrails",
    "@caisson-sh/jobs",
    "@caisson-sh/kernel",
    "@caisson-sh/prompt-registry",
    "@caisson-sh/tenancy-rls",
  ],
  description:
    "AI Production Kit: the metered infer() gateway composing prompt-registry + ai-meter + guardrails + ai-config behind Vercel AI SDK v7 — the enforced chokepoint for every AI feature (ADR-0059).",
});

// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/ai-kit",
  version: pkg.version,
  license: pkg.license,
  dependencies: [
    "@caisson/agent-trajectory",
    "@caisson/ai-config",
    "@caisson/ai-meter",
    "@caisson/credits",
    "@caisson/field-crypto",
    "@caisson/guardrails",
    "@caisson/jobs",
    "@caisson/kernel",
    "@caisson/prompt-registry",
    "@caisson/tenancy-rls",
  ],
  description:
    "AI Production Kit: the metered infer() gateway composing prompt-registry + ai-meter + guardrails + ai-config behind Vercel AI SDK v7 — the enforced chokepoint for every AI feature (ADR-0059).",
});

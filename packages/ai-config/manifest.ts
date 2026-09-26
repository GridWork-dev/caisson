// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest.ts";

export default defineModule({
  id: "@caisson-sh/ai-config",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson-sh/kernel"],
  description:
    "Provider-agnostic AI config resolver (OpenAI, Anthropic, Google, OpenRouter, local) + the app's forge.config settings file (ADR-0011).",
});

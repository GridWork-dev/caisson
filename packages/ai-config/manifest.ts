// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "base"` — provider-agnostic AI config is a base primitive
// shared by ai-kit and mcp-server; never an edition (ADR-0003). Open Base: Apache-2.0, oss tier (ADR-0094 open-core).
//
// Open Base ships free: tier `oss`, no priceCents (ADR-0094 open-core). Dependencies are DOWN-ONLY (ADR-0003).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest.ts";

export default defineModule({
  id: "@caisson/ai-config",
  version: pkg.version,
  kind: "base",
  tier: "oss",
  priceCents: null,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  description:
    "Provider-agnostic AI config resolver (OpenAI, Anthropic, Google, OpenRouter, local) + buyer forge.config settings file (ADR-0011).",
});

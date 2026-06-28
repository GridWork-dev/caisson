// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "base"` — provider-agnostic AI config is a base primitive
// shared by ai-kit and mcp-server; never an edition (ADR-0003). Paid + LicenseRef-Caisson-Commercial
// (ADR-0023/0050).
//
// `priceCents` is a PLACEHOLDER pending the still-open Pricing lock (ADR-0012 anchors only) — it must
// be a positive integer (ADR-0007), not a final number. Dependencies are DOWN-ONLY (ADR-0003).
import { defineModule } from "../../registry/schema/module-manifest.ts";

export default defineModule({
  id: "@caisson/ai-config",
  version: "0.0.0",
  kind: "base",
  tier: "paid",
  priceCents: 4900,
  license: "LicenseRef-Caisson-Commercial",
  dependencies: ["@caisson/kernel"],
  description:
    "Provider-agnostic AI config resolver (OpenAI, Anthropic, Google, OpenRouter, local) + buyer forge.config settings file (ADR-0011).",
});

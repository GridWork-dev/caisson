// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "base"` — the buyer MCP gateway is a base package; it is
// consumed by editions but is never itself an edition (ADR-0003). Open Base: Apache-2.0, oss tier (ADR-0094 open-core).
//
// Open Base ships free: tier `oss`, no priceCents (ADR-0094 open-core). Dependencies are DOWN-ONLY (ADR-0003).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest.ts";

export default defineModule({
  id: "@caisson/mcp-server",
  version: pkg.version,
  kind: "base",
  tier: "oss",
  priceCents: null,
  license: pkg.license,
  dependencies: [
    "@caisson/ai-config",
    "@caisson/ds-manifest",
    "@caisson/kernel",
    "@caisson/registry-schema",
    "@caisson/ui",
  ],
  description:
    "Auth-gated buyer MCP: timing-safe Bearer verify, entitlement-scoped reads, allowlist + credit-gated generate tools (ADR-0008/0004).",
});

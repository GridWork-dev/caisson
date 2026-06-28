// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "base"` — the buyer MCP gateway is a base package; it is
// consumed by editions but is never itself an edition (ADR-0003). Paid + LicenseRef-Caisson-Commercial
// (ADR-0023/0050).
//
// `priceCents` is a PLACEHOLDER pending the still-open Pricing lock (ADR-0012 anchors only) — it must
// be a positive integer (ADR-0007), not a final number. Dependencies are DOWN-ONLY (ADR-0003).
import { defineModule } from "../../registry/schema/module-manifest.ts";

export default defineModule({
  id: "@caisson/mcp-server",
  version: "0.0.0",
  kind: "base",
  tier: "paid",
  priceCents: 4900,
  license: "LicenseRef-Caisson-Commercial",
  dependencies: ["@caisson/ai-config", "@caisson/kernel", "@caisson/registry"],
  description:
    "Auth-gated buyer MCP: timing-safe Bearer verify, entitlement-scoped reads, allowlist + credit-gated generate tools (ADR-0008/0004).",
});

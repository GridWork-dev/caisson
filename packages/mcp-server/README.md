# @caisson/mcp-server

Auth-gated buyer-facing MCP server (entitlement-scoped).

- **Layer:** base

Real src + tests: timing-safe Bearer-token auth on every tool call, entitlement-scoped reads (a
caller only sees the modules its purchase actually grants, resolved through
`@caisson/registry-schema`'s allowlist), and a credit-gated `generate` tool that debits before
writing (the same debit-before-spend seam as the CLI). Ships the setup-coach tools that walk a
buyer from "no AI config" to a validated `forge.config` without ever handling a secret value —
see `AGENTS.md` for the tool contract.

## Local design-system discovery MCP

`discovery-bin.ts` is a separate, **local stdio-only** MCP a coding agent runs to discover the open
`@caisson/ui` kit — no Caisson account, no bearer, no network listener. It exposes three read tools
(`list_components`, `describe_component`, `get_tokens`) over the committed Apache-base component
manifest. Configure it in your MCP client:

```json
{
  "mcpServers": {
    "caisson-ds": {
      "command": "node",
      "args": ["node_modules/@caisson/mcp-server/dist/discovery-bin.js"]
    }
  }
}
```

Verification (`check_usage`, the static doctor) and any pro-component metadata are **not** on this
server — they are entitlement-gated tools on the authenticated buyer MCP.

Licensed Apache-2.0 (open Base substrate).

# @caisson/mcp-server

Auth-gated buyer-facing MCP server (entitlement-scoped).

- **Layer:** base

Real src + tests: timing-safe Bearer-token auth on every tool call, entitlement-scoped reads (a
caller only sees the modules its purchase actually grants, resolved through
`@caisson/registry-schema`'s allowlist), and a credit-gated `generate` tool that debits before
writing (the same debit-before-spend seam as the CLI). Ships the setup-coach tools that walk a
buyer from "no AI config" to a validated `forge.config` without ever handling a secret value —
see `AGENTS.md` for the tool contract.

## Resources

Alongside its tools, the authenticated buyer MCP exposes **readable resources** on both transports
(stdio + Streamable-HTTP). Resources are the read-side mirror of the tool registry: entitlement-scoped
the same way (a resource a caller is not entitled to is invisible — `resources/list` omits it and
`resources/read` returns the same not-found an unknown URI gets), rate-limited through the same
ADR-0112 hook, and served under the same timing-safe Bearer gate.

URIs follow a stable `caisson://<namespace>/<name>` scheme:

| URI                                      | Entitlement                    | Content                                                                                                                     |
| ---------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `caisson://registry/index`               | none (any authenticated buyer) | The full module registry catalog (modules, versions, tiers, prices) as JSON.                                                |
| `caisson://design-system/components`     | none                           | The open `@caisson/ui` component roster as JSON (present only when the host wires `dsManifest`).                            |
| `caisson://design-system/tokens`         | none                           | The `@caisson/ui` design tokens (themes, functional colours, fonts) as JSON.                                                |
| `caisson://design-system/pro-components` | `@caisson/ui-pro`              | The `@caisson/ui-pro` component roster as JSON (present only when a pro manifest is wired; invisible without the pro tier). |

The design-system resources are an additional protocol front over the SAME pure read functions the
`list_components` / `get_tokens` tools use — one data layer, two fronts. The registry-index resource
exposes the full catalog as-held: discovery is the point, and prices/tiers are already public
marketing data.

## Prompts

The authenticated buyer MCP also exposes **prompts** on both transports — the prompt-side mirror of
the tool and resource registries. Prompts are entitlement-scoped the same way (a prompt a caller is
not entitled to is invisible: `prompts/list` omits it and `prompts/get` returns the same not-found an
unknown name gets), rate-limited through the same ADR-0112 hook, and served under the same
timing-safe Bearer gate. Each `prompts/get` validates the caller's arguments against the prompt's
declared argument set (strict — a missing required argument and any undeclared extra key are both
rejected) before rendering.

| Prompt                            | Entitlement                    | Renders                                                                                                                                              |
| --------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `integrate_module`                | none (any authenticated buyer) | A `describe_module` → `generate` recipe for adding one purchased module to a project.                                                                |
| `setup_ai_config`                 | `ai-kit`                       | The guided `inspect_env` → `propose_ai_config` → `validate_setup` → `write_forge_config` walkthrough (present only when the host wires `coach`).     |
| `compliance_evidence_walkthrough` | `compliance`                   | A `generate` recipe for the compliance edition, plus where framework evidence assembly lives (present only when the host wires `compliancePrompts`). |

Prompts carry provider/module IDENTIFIERS only — never a secret value — so they stay secrets-safe by
construction like the coach tools they narrate.

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

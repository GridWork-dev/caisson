# @caisson-sh/mcp-server

Bearer-authenticated MCP server over the Caisson module catalog.

- **Layer:** base

Real src + tests: timing-safe Bearer-token auth on every session, catalog reads (`list_modules`,
`describe_module`) over the registry index, and a `generate` tool that validates every requested
`{id, version}` against that index before handing the selection to your host's `onGenerate` hook.
Every registered tool, resource and prompt is visible to every authenticated caller. Ships the
setup-coach tools that walk a user from "no AI config" to a validated `forge.config` without ever
handling a secret value — see `AGENTS.md` for the tool contract.

## Resources

Alongside its tools, the server exposes **readable resources** on both transports (stdio +
Streamable-HTTP). Resources are the read-side mirror of the tool registry: an unknown URI is a
not-found, reads are rate-limited through the same ADR-0112 hook, and everything is served under
the same timing-safe Bearer gate.

URIs follow a stable `caisson://<namespace>/<name>` scheme:

| URI                                      | Content                                                                                             |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `caisson://registry/index`               | The full module registry catalog (modules and versions) as JSON.                                    |
| `caisson://design-system/components`     | The open `@caisson-sh/ui` component roster as JSON (present only when the host wires `dsManifest`). |
| `caisson://design-system/tokens`         | The `@caisson-sh/ui` design tokens (themes, functional colours, fonts) as JSON.                     |
| `caisson://design-system/pro-components` | The `@caisson-sh/ui-pro` component roster as JSON (present only when a pro manifest is wired).      |

The design-system resources are an additional protocol front over the SAME pure read functions the
`list_components` / `get_tokens` tools use — one data layer, two fronts.

## Prompts

The server also exposes **prompts** on both transports — the prompt-side mirror of the tool and
resource registries: an unknown name is a not-found, gets are rate-limited through the same
ADR-0112 hook, and everything is served under the same timing-safe Bearer gate. Each `prompts/get`
validates the caller's arguments against the prompt's declared argument set (strict — a missing
required argument and any undeclared extra key are both rejected) before rendering.

| Prompt                            | Renders                                                                                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `integrate_module`                | A `describe_module` → `generate` recipe for adding one catalog module to a project.                                                                  |
| `setup_ai_config`                 | The guided `inspect_env` → `propose_ai_config` → `validate_setup` → `write_forge_config` walkthrough (present only when the host wires `coach`).     |
| `compliance_evidence_walkthrough` | A `generate` recipe for the compliance modules, plus where framework evidence assembly lives (present only when the host wires `compliancePrompts`). |

Prompts carry provider/module IDENTIFIERS only — never a secret value — so they stay secrets-safe by
construction like the coach tools they narrate.

## Local design-system discovery MCP

`discovery-bin.ts` is a separate, **local stdio-only** MCP a coding agent runs to discover the open
`@caisson-sh/ui` kit — no bearer, no network listener. It exposes three read tools
(`list_components`, `describe_component`, `get_tokens`) over the committed base component manifest.
Configure it in your MCP client:

```json
{
  "mcpServers": {
    "caisson-ds": {
      "command": "node",
      "args": ["node_modules/@caisson-sh/mcp-server/dist/discovery-bin.js"]
    }
  }
}
```

Verification (`check_usage`, the static doctor) and any pro-component metadata are **not** on this
server — they are tools on the Bearer-authenticated server.

Licensed Apache-2.0.

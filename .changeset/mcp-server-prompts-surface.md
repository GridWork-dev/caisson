---
"@caisson/mcp-server": minor
---

Add an MCP prompts surface to the buyer MCP, the prompt-side mirror of the tool and resource
registries. Prompts are entitlement-scoped exactly like tools and resources (a prompt a caller is not
entitled to is invisible: prompts/list omits it and prompts/get returns the same not-found an unknown
name gets), rate-limited through the same per-account hook, and served under the same timing-safe
Bearer gate. Each prompts/get validates the caller's arguments against the prompt's declared argument
set — a missing required argument and any undeclared extra key are both rejected — before rendering.
Both transports (stdio and Streamable-HTTP) now advertise the prompts capability and wire
prompts/list and prompts/get.

Three prompts ship: integrate_module (open to any authenticated buyer) narrates a describe_module
then generate recipe for adding one purchased module to a project and validates the module against
the registry allowlist up front; setup_ai_config (ai-kit tier) is the guided inspect_env,
propose_ai_config, validate_setup, write_forge_config walkthrough; and compliance_evidence_walkthrough
(compliance tier) renders a generate recipe for the compliance edition plus where framework evidence
assembly lives. Prompts carry provider and module identifiers only, never a secret value, so they stay
secrets-safe by construction like the coach tools they narrate.

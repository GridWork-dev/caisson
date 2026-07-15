---
"@caisson/mcp-server": minor
---

Add the agent-ready design-system tools to the buyer MCP: three base read tools
(list_components / describe_component / get_tokens) any authenticated buyer can call to discover the
open @caisson/ui kit, plus an entitlement-gated check_usage static doctor (on a dedicated doctor
slug) and an optional gated describe_pro_component. Ships a local stdio-only discovery server that
exposes the three read tools over the Apache-base manifest with no auth and no network listener, and
a runnable discovery entry an agent configures as a local MCP.

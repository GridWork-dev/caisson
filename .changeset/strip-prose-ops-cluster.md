---
"@caisson/agent-dev": patch
"@caisson/agent-kernel": patch
"@caisson/agent-runner": patch
"@caisson/auth": patch
"@caisson/cli": patch
"@caisson/jobs": patch
"@caisson/local-store": patch
"@caisson/mcp-server": patch
"@caisson/migrate": patch
"@caisson/observability": patch
"@caisson/registry-schema": patch
"@caisson/tool-exec": patch
"@caisson/ui": patch
---

Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
internal build-phase shorthand, and bare specification-id citations that had leaked into
shipped copy. No runtime behavior changed in any package — documentation and comments only.

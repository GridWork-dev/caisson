---
"@caisson/mcp-server": patch
---

The HTTP MCP transport now rejects a wildcard origin at server construction — an
`allowedOrigins` allowlist containing a bare `"*"` throws immediately instead of being
accepted, so a misconfigured deployment can never silently open MCP tool calls to every
origin. Every response from the HTTP handler (success, auth failure, and body-parse
error paths) also now carries the standard security response headers
(`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`).

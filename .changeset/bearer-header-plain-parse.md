---
"@caisson-sh/mcp-server": patch
---

The HTTP transport reads the `Authorization` header with a prefix check instead of a regular
expression. The same headers are accepted and rejected as before.

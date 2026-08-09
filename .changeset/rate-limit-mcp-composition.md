---
"@caisson/rate-limit": minor
---

Add `createRateLimitedMcpServer`, a public composition factory that wires the RLS-scoped account throttle into `@caisson/mcp-server`, preserves caller overrides, and reports store failures without locking buyers out.

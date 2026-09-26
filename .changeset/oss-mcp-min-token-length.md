---
"@caisson/mcp-server": patch
"@caisson/rate-limit": patch
---

`createMcpServer` now refuses an empty Bearer token, or one shorter than 32 characters, when the server is built, so a guessable token can never go live. The error names the account and never the token. The stdio and HTTP transports and `createRateLimitedMcpServer` all build through it. Token comparison is unchanged.

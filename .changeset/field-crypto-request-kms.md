---
"@caisson/field-crypto": minor
"@caisson/ai-kit": minor
"@caisson/agent-trajectory": minor
"@caisson/site": patch
---

Add disposable request-scoped KMS contexts with append-only Postgres wrapped-key persistence,
wire production BYOK to purge-protected Azure Key Vault keys, and let MCP run tools bind an async
field-crypto context and its tenant executor in one atomic transaction without retaining plaintext
keys between requests.

---
"@caisson/site": patch
---

The guardrails and local-inference interactive demos now execute the shipped browser-safe package
surfaces instead of maintaining site-local copies. PII handling, moderation decisions, deterministic
embeddings, model-host policy, and egress checks therefore stay pinned to the same code buyers run.

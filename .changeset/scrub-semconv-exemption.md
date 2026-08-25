---
"@caisson/observability": patch
---

Span-attribute scrub: an exact OTel semantic-convention attribute name no longer trips the credential terms of the key deny-list. `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `session.id`, `mcp.session.id` and 15 other real attribute names were reaching the OTLP sink as `[REDACTED]`, blanking LLM usage and session correlation. The exemption is exact-match only and never reaches the PII arm, so `user.email` and `user.full_name` (also semconv names) still redact, as do header templates, case variants, and anything the package does not export. The suite now sweeps the package's full exported name set.

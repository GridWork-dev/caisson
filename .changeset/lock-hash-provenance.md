---
"@caisson/registry": patch
"@caisson/ai-kit": patch
"@caisson/registry-schema": patch
"@caisson/agent-trajectory": patch
---

Release integrity hardening: every recorded package artifact now carries the dependency
resolution it was built under, so a resolution change between releases is reported as a
precise "republish this package" notice instead of a checksum mismatch. The agent loop's
credit-budget guard is restated in fail-closed form, and stale documentation comments in
the registry schema and the agent-trajectory manifest are corrected. No behavioral
changes to published APIs.

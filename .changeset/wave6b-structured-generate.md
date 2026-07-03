---
"@caisson/ai-kit": minor
---

Added `structuredGenerate<T>()`, a typed wrapper around the metered inference call for
callers that want a parsed, schema-validated JSON value instead of raw model text. Pass a
Zod schema and it returns `{ value, raw }` on success; on an empty completion, malformed
JSON, or a schema mismatch it throws a typed `StructuredGenerateError` (with a `reason` of
`refusal`, `invalid_json`, or `schema_mismatch`) instead of silently handing back an empty
or unusable result. This closes a class of bug where a blocked or malformed model response
was easy to miss because nothing failed loudly.

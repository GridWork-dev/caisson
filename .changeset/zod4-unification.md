---
"@caisson/ai-evals": patch
"@caisson/compliance-core": patch
"@caisson/kernel": patch
"@caisson/prompt-registry": patch
---

Unify the workspace on zod 4 (catalog flip; the zod4 sub-catalog is retired). Explicit key schemas on every z.record call, and the ZodObject generic signatures drop the v3 "strict" type parameter. Runtime validation behavior is unchanged apart from zod 4's tightened RFC-4122 uuid and email format checks, verified against the money and license seams.

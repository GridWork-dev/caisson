---
"@caisson/ai-config": patch
"@caisson/ai-evals": patch
"@caisson/ai-kit": patch
"@caisson/ai-meter": patch
"@caisson/prompt-registry": patch
"@caisson/guardrails": patch
"@caisson/local-ai": patch
---

Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
internal build-phase shorthand, and bare specification-id citations that had leaked into
shipped copy, and regenerated a couple of stale public-surface sections against the actual
exports. No runtime behavior changed in any package — documentation and comments only.

---
"@caisson/ai-evals": patch
---

The committed injection-defense eval dataset grows from 2 to 20 attack patterns — covering
encoded and obfuscated overrides, delimiter escapes, tool-invocation coercion, data
exfiltration via rendered links, indirect injection through retrieved documents,
role-reversal, false authority, few-shot poisoning, payload splitting, refusal suppression,
and prompt-extraction attempts. The eval gate additionally enforces a statistical confidence
floor on the injection scorer, so a shrunk dataset can no longer pass on a flattering mean.

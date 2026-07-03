---
"@caisson/kernel": patch
---

Added a regression test for the operator-allowlist check that pins the constant-time
comparison contract: every entry is compared, and the number of comparisons performed
stays the same whether the match is the first entry, the last entry, or no match at all.
No behavior change — the allowlist check already worked this way.

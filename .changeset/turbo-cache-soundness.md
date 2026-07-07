---
"@caisson/standards-gate": patch
---

Disable turbo caching on the standards-gate test task. The suite reads the registry ledger and
every workspace package.json at runtime — outside its package input globs — so cache hits could
report stale-green results. Its effective inputs are the whole repo; running fresh every time is
the sound behavior.

---
"@caisson/local-store": patch
---

Add LocalStore.list({ limit, offset }) — a bounded, newest-first page over the docs table for
read-only consumers (the agent-dev inspector's /memory route) that want "what's in
here" rather than a ranked hybridSearch query. Limit and offset are clamped, never thrown on.

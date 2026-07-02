---
"@caisson/kernel": patch
---

Expose `fetchWithTimeout` via a client-safe `@caisson/kernel/fetch` subpath export so browser bundles can honor the fetchWithTimeout rule without pulling the server-only barrel.

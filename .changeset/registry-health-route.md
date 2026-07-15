---
"@caisson/registry": patch
---

Add a dedicated unauthenticated health route to the registry read Worker: GET /health returns a 200 with the registry schema version and is never cached, giving uptime monitors a stable check target that reads no data.

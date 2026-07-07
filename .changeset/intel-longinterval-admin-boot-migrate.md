---
"@caisson/service-intel": patch
"@caisson/admin": patch
---

Fix the intelligence scheduler so watcher cadences longer than about 24.8 days fire at their true interval instead of collapsing into a tight loop, and run the admin control-plane's auth-table migration at server boot — with the health check failing closed if that migration does not succeed, so a broken deploy is never marked healthy.

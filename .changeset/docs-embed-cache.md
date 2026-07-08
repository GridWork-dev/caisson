---
"@caisson/service-docs": patch
---

The docs service now keeps a content-hash embedding cache on its persistent volume: a redeploy
with an unchanged corpus makes zero embedding calls instead of re-embedding every chunk, and
only changed content is embedded when docs are updated.

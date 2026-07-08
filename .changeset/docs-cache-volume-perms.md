---
"@caisson/service-docs": patch
---

The docs service's embedding cache now actually persists on its mounted volume: the container
entrypoint hands the volume to the runtime user before dropping privileges (volumes mount
root-owned), and cache read/save failures are logged with their error code instead of failing
silently.

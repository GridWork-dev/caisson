---
"@caisson/jobs": patch
---

Bump the supplied ioredis runtime dependency to v6. BullMQ declares ioredis as an optional peer with range >=5.0.0, so the driver contract is unchanged; the connection is still built by the caller and passed through. Reviewed against the v6 release notes (RESP3 by default with RESP2-compatible reply shapes) with the full jobs suite green.

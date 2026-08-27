---
"@caisson/site": patch
"@caisson/admin": patch
"@caisson/service-docs": patch
"@caisson/service-license": patch
---

Health probe paths now answer ahead of the edge origin gate. The platform healthcheck reaches each container internally and cannot carry the edge-injected origin-secret header, so arming the gate as the first check made every one of the four gated services fail its own readiness probe and froze the whole deploy path. The exemption is keyed on exact string equality against each service's configured `healthcheckPath`, never a prefix, so a trailing slash, a longer path, a differing case and a traversal segment all stay behind the gate; a per-service test pins the constant against the deployment manifest so a drift in either cannot silently re-freeze deploys.

Because the probe path is now reachable without the secret, the responses shrink to liveness for unauthenticated callers. The docs service withholds its corpus chunk count, and the license service and the operator control-plane withhold their registry index digest and entry count, unless the caller presents a valid origin secret. Traffic arriving through the edge carries that header, so the registry index parity probe keeps reading the digest from both services; only a caller reaching a raw platform origin directly is reduced to a bare status.

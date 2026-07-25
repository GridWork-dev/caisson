---
"@caisson/local-inference": patch
---

Bedrock rented transport surfaces bounded, credential-scrubbed AWS error diagnostics (`__type`/`message` + a 4KB-capped body) on non-2xx instead of status-only, making live-leg failures diagnosable without echoing SigV4 headers or credentials (CAISSON-74).

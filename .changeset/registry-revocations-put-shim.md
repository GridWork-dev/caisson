---
"@caisson/registry": patch
---

The registry Worker gains its one write surface: an authed `PUT /revocations/deny-set.json`
publisher endpoint for the license-revocation deny-set. Bearer-gated behind a worker secret
(timing-safe digest compare), strict-schema validated against the exact shape the edge reader
parses, size-capped, and the stored artifact is a canonical deduped re-serialization — never raw
request bytes. The route serves 404 until both the secret and the bucket binding are provisioned;
all responses carry the standard security headers.

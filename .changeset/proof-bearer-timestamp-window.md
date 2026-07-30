---
"@caisson/admin": patch
"@caisson/site": patch
---

The internal proof bearer now carries a signed timestamp and is rejected outside a five-minute
acceptance window, so the credential expires instead of staying valid until the secret rotates.
The verifier still accepts the legacy untimestamped form during the verifier-first rollout, and
the internal-proof rate limiter no longer consumes an account token on a globally-denied request.

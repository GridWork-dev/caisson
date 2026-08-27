---
"@caisson/local-store": patch
"@caisson/service-betterstack-adapter": patch
"@caisson/audit-worm": patch
"@caisson/agent-runner": patch
---

The reference cloud embedder now validates the destination, not just the scheme. Its config schema proved the endpoint was https and nothing more, so a private, loopback or cloud-metadata address was a valid endpoint and the embedder would POST the configured Bearer credential to it. The shared public-host guard already used by four sibling egress sinks now runs once at construction, and the credential-bearing request refuses to follow redirects so a 3xx cannot re-target it past that check. The check is deliberately literal-host only and construction-time: the embedder wraps per text, so a name-resolving check on that path would cost a lookup per embedded string and break split-horizon deployments.

The alerting webhook adapter now sends the standard security headers on every response rather than only a content type. All of its return paths, including the unauthorized one, share a single response constructor, so the headers apply by construction; a test now sweeps each status path individually rather than sampling the success case.

The external timestamping client refuses redirects on submission. Its acceptance of cleartext and private-network endpoints is unchanged and now has a test pinning that behaviour, because only a hash is transmitted, trust comes from verifying the signed response rather than from the transport, and an internal timestamp authority is a supported deployment — applying a public-host restriction there would break both mainstream public authorities and self-hosted buyers.

One comment corrected: the agent runner's endpoint check describes admitting cleartext for loopback providers, while the code admits it for any host. The code is right — named service endpoints are the common local deployment — and the comment now says so.

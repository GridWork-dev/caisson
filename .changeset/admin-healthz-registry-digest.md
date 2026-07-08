---
"@caisson/admin": patch
---

`/healthz` now reports the baked `registry/index.json` digest (sha256 first-12-hex) and
entry count alongside the readiness flag, mirroring the license service's own field. This
is the admin leg of the registry index-parity probe (`registry/scripts/index-parity-probe.ts`):
it can now confirm the admin image serves the same index as the repo and the license
service, since `/healthz` is an unauthenticated Railway readiness route reachable without
the operator's own session. A missing or unreadable index file omits the fields rather
than failing readiness. Private package only; no publishable release.

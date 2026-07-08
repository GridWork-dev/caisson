---
"@caisson/registry": patch
---

The index-parity probe (`registry/scripts/index-parity-probe.ts`) now also compares the
admin service's baked index against the repo reference, using the same strong digest
check as the license leg — completing the three-way parity check now that the admin
control-plane's own sign-in has made `/healthz` externally reachable without the edge
gate the leg previously required. Private package only; no publishable release.

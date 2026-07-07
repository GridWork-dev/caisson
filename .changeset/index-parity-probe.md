---
"@caisson/registry": patch
---

Add an index-parity probe script that compares the registry index shipped in the repo
against the copies served by the deployed registry and the license service, printing a
per-copy table and exiting non-zero when any reachable copy serves a stale or unexpected
entry. Private package only; no publishable release.

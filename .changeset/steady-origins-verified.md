---
"@caisson/site": patch
"@caisson/demos": patch
"@caisson/registry": patch
---

Deployment documentation now matches the deployed reality. The `apps/site` service
env block is regenerated from the live variable list — names only, verified for exact
parity in both directions — and the stale scaffold comments that described live
infrastructure as not-yet-created are removed from the demos service config, the
registry Worker config, and the Railway deploy workflow. No runtime behaviour changes
in these packages.

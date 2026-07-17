---
"@caisson/registry": patch
---

Re-record the platform-reads tarball sidecar row a second time: the packed bytes embed resolved
workspace dev-dependency versions, so the service-license bump in the previous consume changed the
pack at an unchanged platform-reads version and staled the row again. Recorded from a pristine
checkout of the tagged commit; the systemic dev-dependency-resolution churn is tracked for an
upstream fix.

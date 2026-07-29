---
"@caisson/jobs": patch
---

The Inngest driver now declares the minimum Inngest release it was built and tested against instead of accepting any release in that major line. Installs that resolve an older Inngest no longer satisfy the dependency and get a clear resolution error rather than a runtime failure.

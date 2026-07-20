---
"@caisson/cli": patch
---

The Next.js starter template's dependency pins now track the current package versions (all
seven were stale, two unsatisfiably so — a newly generated Next.js project failed install). A
new guard test reads the real workspace versions, so any future package bump fails loudly until
the template pin rides along in the same change — the same protection the sample template
already had.

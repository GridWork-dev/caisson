---
"@caisson/admin": patch
---

Business admin's tenants table now shows each account's resolved email address, adds a
search box that matches on account id or email, and paginates instead of loading every
row at once. The other business tables now cap their reads to a bounded page instead of
running unbounded. Private package only; no publishable release.

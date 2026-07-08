---
"@caisson/site": patch
---

Signing out now revokes your session on the server, not just the cookie in your browser, so a
previously captured session token can no longer be reused after you've signed out. Also, the
Compliance dashboard page and its evidence-record download now correctly require the Compliance
core entitlement (or an equivalent bundle) — previously any signed-in account could open it
regardless of purchase status.

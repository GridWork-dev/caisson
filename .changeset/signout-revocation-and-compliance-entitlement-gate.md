---
"@caisson/site": patch
---

Signing out now revokes your session on the server, not just the cookie in your browser, so a
previously captured session token can no longer be reused after you've signed out. The sign-out
request is also now checked to make sure it actually came from the site itself, closing off a way
another website could have forced a visitor's browser to sign out. Separately, the Compliance
dashboard page and its evidence-record download now correctly require the Compliance core
entitlement (or an equivalent bundle) — previously any signed-in account could open it regardless
of purchase status.

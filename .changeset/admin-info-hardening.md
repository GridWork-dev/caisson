---
"@caisson/admin": patch
---

Three small hardening fixes to the admin control-plane: the Business page's `?page=`
query param is now capped so a hand-crafted huge value can't overflow the tenant list
query and 500 the page; the overview board gains a card for the Intel section (it was
already reachable from the top nav but missing from the home page); and the
purchase-email resend action now throttles to one send per account per minute so a
mis-click or scripted loop can't spam an account's inbox. Private package only; no
publishable release.

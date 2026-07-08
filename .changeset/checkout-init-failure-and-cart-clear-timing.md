---
"@caisson/site": patch
---

Fixed two checkout reliability bugs. A failed Paddle checkout load (ad-blocker, flaky network,
misconfigured token) used to silently break checkout for the rest of your session — reloading the
page is no longer required, and the Pay button now shows a real error message instead of just
reverting. Also, your cart is now cleared only after a payment actually completes, not the instant
the checkout window opens — if you open checkout to review the total and then cancel, your cart
lines are no longer lost.

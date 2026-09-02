---
"@caisson/site": patch
---

The signed-in session hint cookie used to skip an ownership check for signed-out visitors is now
HttpOnly, so page scripts can no longer read a visitor's authentication state from it. The
ownership check itself always fires now; the server route short-circuits internally when the
cookie is absent, so the same signed-out fast path is preserved without exposing a readable
auth signal.

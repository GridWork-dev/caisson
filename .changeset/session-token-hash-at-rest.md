---
"@caisson/auth": minor
"@caisson/site": patch
---

Session tokens are now stored hashed at rest: buyer session cookies are looked up by an
HMAC-SHA-256 lookup key instead of the raw bearer token, so a database export alone is no
longer a usable session credential. This ships as a one-time hard cutover — every
currently-signed-in buyer is signed out and simply signs back in.

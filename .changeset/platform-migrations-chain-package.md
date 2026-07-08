---
"@caisson/platform-migrations": minor
"@caisson/site": patch
"@caisson/admin": patch
---

A shared platform migration chain, so the marketing/dashboard app and the operator admin app
apply the exact same ordered database schema.

`@caisson/platform-migrations` is a new, private, unpublished package: the ordered chain of
platform schema migrations (credits, entitlements, licenses, usage metering, and their
follow-on columns), plus a small helper that assembles and applies the chain against either a
real Postgres or an in-memory PGlite double. It is the one place this chain is defined now.

The marketing/dashboard app's deploy-time migration runner reads the chain from this new
package instead of declaring it locally. The admin app's local development database bootstrap
now applies the SAME chain instead of hand-copying individual schema pieces — closing off a
class of drift where the admin app's local database could silently fall behind the real one. A
new automated check boots the admin app's local database and confirms every cross-tenant read
table exists with the correct row-level security in place.

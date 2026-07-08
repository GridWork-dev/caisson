---
"@caisson/service-license": patch
"@caisson/admin": patch
---

Adds an admin rescue action that first-mints a license for an account that holds paid
entitlements but never received one, for the cases where the license reissue action
cannot help because there is no prior grant to re-serve. It mints through the same
license-issuing path the reissue action already uses, is bounded to one account per call,
and is fully audit-logged like every other admin action. Private package only; no
publishable release.

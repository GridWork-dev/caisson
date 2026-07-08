---
"@caisson/service-license": patch
"@caisson/admin": patch
---

Adds an admin action that resends a purchase-confirmation-style email to an account's
own address, carrying its current entitlements and a dashboard link, for support cases
where a buyer needs their access back in their inbox. It is not a byte-exact copy of the
original receipt. Audit-logged like every other admin action. Private package only; no
publishable release.

---
"@caisson/license-verify": minor
"@caisson/license-issue": patch
---

License claims gain an optional, nullable `updatesUntil` ISO instant (the 12-month updates window). A token without the field — every previously issued token — still verifies and reads as unbounded; the registry filters served versions to `publishedAt <= updatesUntil`. The issuer passes the field through the shared schema unchanged.

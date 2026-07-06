---
"@caisson/license-verify": minor
"@caisson/license-issue": patch
---

License claims gain an optional, nullable `updatesUntil` ISO instant (ADR-0244/0251 updates window). A token without the field — every pre-0251 token — still verifies and reads as unbounded; the registry filters served versions to `publishedAt <= updatesUntil`. The issuer passes the field through the shared schema unchanged.

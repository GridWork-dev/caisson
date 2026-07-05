---
"@caisson/rate-limit": patch
"@caisson/service-license": patch
"@caisson/app-base": patch
---

Moved the per-account throttle store out of the commercial license service and into the
new shared, freely licensed rate-limiting package. The open reference application now
composes this shared store directly for its buyer-facing throttling instead of depending
on the commercial license service to get it. Buyer-visible throttling behavior is
unchanged; this only changes where the code lives and removes an unnecessary dependency
from the open reference application.

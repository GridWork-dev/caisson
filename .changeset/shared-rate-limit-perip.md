---
"@caisson/rate-limit": patch
"@caisson/service-docs": patch
"@caisson/service-license": patch
"@caisson/standards-gate": patch
---

Added a new shared rate-limiting package with an in-memory per-client-IP throttle for
surfaces with no signed-in identity yet. The docs and license services now both import
this shared limiter instead of each keeping a separate copy of the same logic. The
internal licensing-boundary check also now recognizes the new package as part of the
open, freely licensed base set. Buyer-visible throttling behavior, including the limits,
the retry timing, and which header is trusted for the client IP, is unchanged; this only
changes where the code lives.

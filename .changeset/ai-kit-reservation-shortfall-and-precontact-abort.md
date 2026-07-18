---
"@caisson/ai-kit": patch
---

Fixed two edge cases in the metered inference gateway's billing path. A reconcile that needed
to charge above the up-front reservation, but hit a wallet that couldn't cover the difference,
now surfaces a distinct `OrphanedReservationError` instead of an unmarked insufficient-credits
error — the held reservation is no longer invisible, and a later retry under the same call id
settles it exactly once. And a stream aborted before the provider was ever contacted now settles
zero cost instead of the estimated input tokens; a stream aborted after the provider responded
still charges for what was actually consumed.

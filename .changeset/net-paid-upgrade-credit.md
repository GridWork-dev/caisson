---
"@caisson/platform-reads": patch
"@caisson/billing-orchestration": patch
"@caisson/site": patch
---

The figure behind an upgrade credit can now be read net of refunds: a partial refund is subtracted from what the buyer was charged, a charge in another currency can no longer outrank a dollar one on its raw number alone, and the read is checked against the licensing service's own arithmetic so the two cannot drift apart. What buyers are credited today is unchanged.

A refund notice that names the same purchased line twice is now rejected outright instead of being partly applied. Only the first mention was ever recorded, which quietly left the buyer holding more credit than their refund had left them; the provider is now asked to send the notice again rather than have it half-recorded.

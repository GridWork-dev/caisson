---
"@caisson/platform-reads": patch
"@caisson/billing-orchestration": patch
"@caisson/site": patch
---

Upgrade credit is now calculated from what a buyer actually kept paying, not from what they were originally charged. A partial refund reduces the credit their next purchase earns, which previously it did not, and the read that produces those figures is checked against the licensing service's own arithmetic so the two cannot drift apart.

A refund notice that names the same purchased line twice is now rejected outright instead of being partly applied. Only the first mention was ever recorded, which quietly left the buyer holding more credit than their refund had left them; the provider is now asked to send the notice again rather than have it half-recorded.

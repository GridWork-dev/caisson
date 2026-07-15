---
"@caisson/service-intel": patch
---

Hash-mode compliance change notices (EU AI Act, SOC 2) now persist a bounded normalized snapshot next
to the detection hash and carry a real before/after content delta in the finding payload, so the
composed operator brief can state WHAT changed instead of "content-level delta unavailable"
(CAISSON-101). Private service — versioned, not published.

---
"@caisson/registry": patch
---

The index parity probe now retries a leg before declaring it unreachable. A single transient fetch failure previously rendered as UNREACHABLE, which is indistinguishable from a real outage in a report that feeds launch acceptance; a leg is only called unmeasured after every attempt fails.

---
"@caisson/site": patch
---

Module depth-page prose prices now derive from the canonical catalog instead of hand-typed
literals, so a future price change can never silently desync the page copy. This also fixes
three pages (governed tool execution, org controls, local sync) that rendered raw template
source instead of the intended bundle price. A data-lint now pins both failure modes.

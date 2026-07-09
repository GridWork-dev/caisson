---
"@caisson/registry": patch
---

Adds a free-floor regression test (CAISSON-63) pinning the registry Worker's anonymous
`/index.json` response to exactly the ADR-0136 Apache-2.0 base predicate
(`editions.length === 0 && license === "Apache-2.0"`), derived from the committed
`registry/index.json` rather than a hardcoded id list — so a legitimate new open-base
package doesn't false-positive it while a commercial-package leak still fails loudly.
Private package only; no publishable release.

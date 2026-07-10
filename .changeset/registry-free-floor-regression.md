---
"@caisson/registry": patch
---

Adds a regression test pinning the registry's anonymous catalog response to exactly the
open-source base set — packages with an Apache-2.0 license and no commercial bundle
membership — derived from the committed catalog index rather than a hardcoded id list, so
a legitimate new open package doesn't false-positive the test while a commercial-package
leak still fails loudly. Private package only; no publishable release.

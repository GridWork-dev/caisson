---
"@caisson/kernel": patch
---

The auditor README inside an exported evidence pack no longer prints two commands its reader cannot run. One was an install command for a package that is not distributed through a package registry, and the other pointed at a checkout of a private repository. In their place the README states plainly how the sanctioned verifier is obtained, and names the openly licensed kernel entry points that rebuild the signed bytes and re-check every row, which is the route available to a reader with no relationship to the issuer.

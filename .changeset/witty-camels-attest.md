---
"@caisson/access-review": patch
"@caisson/site": patch
---

The pure half of the access-review campaign kernel — the decision vocabulary, chain record kinds,
the decision scan, and the close guard — now lives in its own internal module with no database or
Node dependencies, and the campaign lifecycle delegates to it, so there is exactly one
implementation of the close rules. Every public export keeps its name and shape. The site's
access-review interactive demo now runs that real logic end to end instead of a hand-maintained
copy.

---
"@caisson/site": patch
---

The local-privacy interactive demo on the site now runs the shipped egress guard itself — the
policy parse, the https-scheme check, the exact-host allowlist lookup, and the sanctioned sink
kind on every verdict come from the real package instead of a hand-maintained copy kept in the
site. The demo's blocked verdicts are the guard's own fail-closed errors, so what a visitor sees
is exactly what the module does. No package behavior changed.

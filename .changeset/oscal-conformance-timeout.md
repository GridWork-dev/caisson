---
"@caisson/compliance": patch
---

De-flake the `oscal-conformance` gate: the JSON→XML→validate round-trip test does two JVM `oscal-cli`
spawns (convert + validate), whose cold-JVM startup can exceed bun's 5s default test timeout on a slow CI
runner (observed 5001ms on the `assessment-results` leg). Add a 60s per-test timeout. Test-only; no
runtime behavior change.

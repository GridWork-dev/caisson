---
"@caisson/compliance": patch
"@caisson/signing-primitive": patch
---

Wire the mirrored evidence-pack goldens to the compliance-core v2 format bump (`crosswalkRollup`,
ADR-0333/ADR-0347): re-blesses each package's static copy of the evidence-pack manifest golden and,
for `@caisson/signing-primitive`, regenerates the golden-with-logic detached Ed25519 signature over
the new canonical bytes (same fixed test key; public key unchanged). No behavior change - fixture
parity only.

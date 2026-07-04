---
"@caisson/license-verify": patch
---

No production-signed license token ships in the package anymore: the committed golden fixture is
removed, and the test suite now proves the shipped key bake negatively — a dev-keypair-signed
token is rejected by the default entrypoint, while all verify logic is exercised through the
explicit-key seam with the documented deterministic dev keypair.

---
"@caisson/compliance-core": patch
---

Test-only: pins that a Rekor `externally-transparent` anchor receipt round-trips the evidence-pack
detached-attachment path — it canonicalizes cleanly (its byte fields are base64/JSON-safe), the
generator tags the `externally-transparent` grade and renders the honest public-log auditor phrase, and
the signed manifest body stays byte-identical. The external-anchor source is already grade-agnostic; no
runtime change.

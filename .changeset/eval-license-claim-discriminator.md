---
"@caisson/license-verify": patch
---

Add an optional `eval` claim to the signed license shape. A verified license now reports whether
it was issued as a time-boxed evaluation grant rather than a paid purchase, so a consuming
application can apply different handling (for example, watermarking or excluding evaluation
installs from redistribution) without guessing from the expiry date alone. Existing tokens and
integrations are unaffected: the field is absent unless an issuer explicitly sets it, and every
paid license continues to verify exactly as before.

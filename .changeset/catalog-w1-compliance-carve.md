---
"@caisson/compliance-core": minor
"@caisson/frameworks-pack": minor
"@caisson/signing-primitive": minor
"@caisson/compliance": minor
---

Splits the Compliance edition into three separately purchasable modules — the framework
catalogs (`@caisson/frameworks-pack`), the per-tenant evidence signer
(`@caisson/signing-primitive`), and the evidence engine (`@caisson/compliance-core`) — while
the Compliance edition keeps composing all three. The public API is unchanged: every symbol
that was importable from `@caisson/compliance` still is.
